import os
import uuid
import shutil
import json
from pathlib import Path
from typing import Dict, Any, Optional, List
import asyncio
from fastapi import Request, UploadFile, BackgroundTasks
from datetime import datetime

from ..external.langflow_repository import LangflowRepository
from ..external.qdrant_repository import QdrantRepository, get_collection_name
from ..external.ollama_repository import OllamaRepository
from ..models.flow import (
    Flow, FlowDeletionResult, FlowExecutionResult,
    FlowComponentInfo, FlowUpload
)
from ..models.document import (
    CollectionCreateResponse, CollectionInfo, FileUploadResponse,
    FileDeletionResponse, CollectionFilesResponse, FileInfo,
    DocumentChunk, DocumentMetadata
)
from ..utils.jwt_helper import get_user_id_from_request, get_user_token, get_admin_token
from ..utils.processing_tracker import processing_tracker
from ..utils.file_embedding import read_file_content, get_text_embedding

BACKEND_UPLOAD_DIR = os.getenv("BACKEND_UPLOAD_DIR", "/tmp/uploads")
LANGFLOW_URL = os.getenv('LANGFLOW_URL')


class FlowService:
    def __init__(self):
        self.langflow_repo = LangflowRepository()
        self.qdrant_repo = QdrantRepository()
        self.ollama_repo = OllamaRepository()

    async def get_user_flows_from_request(
            self,
            request: Request,
            remove_example_flows: bool = True,
            header_flows: bool = False,
            get_all: bool = True
    ) -> List[Dict[str, Any]]:
        """Get user flows from Langflow"""
        token = get_user_token(request)
        if not token:
            raise ValueError("No valid authentication token found")

        flows = await self.langflow_repo.get_flows(
            token=token,
            remove_example_flows=remove_example_flows,
            header_flows=header_flows,
            get_all=get_all
        )
        return flows

    async def validate_user_flow_access(self, request: Request, flow_id: str) -> bool:
        try:
            public_flows = await self.get_public_flows()
            public_flow_ids = [flow.get('id') for flow in public_flows if flow.get('id')]

            if flow_id in public_flow_ids:
                print(f"Flow {flow_id} is public - access granted")
                return True

            try:
                user_flows = await self.get_user_flows_from_request(request)
                user_flow_ids = [flow.get('id') for flow in user_flows if flow.get('id')]

                if flow_id in user_flow_ids:
                    print(f"Flow {flow_id} is owned by user - access granted")
                    return True

            except Exception as e:
                print(f"User authentication failed, but flow might be public: {e}")
                return False

            print(f"Flow {flow_id} not found in user flows or public flows - access denied")
            return False

        except Exception as e:
            print(f"Error checking flow access for {flow_id}: {e}")
            return False

    async def get_flow_by_id(self, request: Request, flow_id: str) -> Dict[str, Any]:
        """Get a specific flow by ID"""
        token = get_user_token(request)
        if not token:
            raise ValueError("No valid authentication token found")

        # Validate access first
        has_access = await self.validate_user_flow_access(request, flow_id)
        if not has_access:
            raise ValueError(f"Flow '{flow_id}' not found or access denied")

        return await self.langflow_repo.get_flow_by_id(flow_id, token)

    async def get_flow_component_ids(self, request: Request, flow_id: str) -> FlowComponentInfo:
        """Get all component IDs from a specific flow"""
        flow_data = await self.get_flow_by_id(request, flow_id)

        flow_name = flow_data.get('name', 'Unknown Flow')
        data = flow_data.get('data', {})
        nodes = data.get('nodes', [])

        component_ids = [node.get('id', '') for node in nodes if node.get('id')]

        # Filter for Qdrant components (you can adjust this logic based on your needs)
        qdrant_component_ids = [
            node.get('id', '') for node in nodes
            if node.get('data', {}).get('type', '').lower() in ['qdrant', 'vectorstore']
        ]

        return FlowComponentInfo(
            flow_id=flow_id,
            flow_name=flow_name,
            total_components=len(component_ids),
            component_ids=component_ids,
            qdrant_component_ids=qdrant_component_ids
        )

    async def upload_flow_file(
            self,
            request: Request,
            file: UploadFile,
            folder_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Upload a flow file to Langflow"""
        token = get_user_token(request)
        if not token:
            raise PermissionError("No valid authentication token found")

        if not file.filename:
            raise ValueError("No filename provided")

        if not file.filename.endswith('.json'):
            raise ValueError("Only JSON files are supported")

        content = await file.read()

        try:
            json.loads(content)
        except json.JSONDecodeError:
            raise ValueError("Invalid JSON file")

        return await self.langflow_repo.upload_flow(
            file_content=content,
            filename=file.filename,
            token=token,
            folder_id=folder_id
        )

    async def delete_flow(self, request: Request, flow_id: str) -> FlowDeletionResult:
        """Delete a flow and its associated collection"""
        token = get_user_token(request)
        if not token:
            raise ValueError("No valid authentication token found")
        user_id = await get_user_id_from_request(request)
        if not user_id:
            raise ValueError("No valid authentication token found")

        # Validate access first
        has_access = await self.validate_user_flow_access(request, flow_id)
        if not has_access:
            return FlowDeletionResult(
                success=False,
                flow_id=flow_id,
                message=f"Flow '{flow_id}' not found or access denied"
            )

        try:
            await self.langflow_repo.delete_flow(flow_id, token)

            collection_cleanup_details = None
            collection_cleanup_error = None
            collections_cleaned = False

            try:
                if await self.qdrant_repo.collection_exists(user_id, flow_id):
                    success = await self.qdrant_repo.delete_collection(user_id, flow_id)
                    collections_cleaned = success
                    collection_cleanup_details = {
                        "flow_id": flow_id,
                        "user_id": user_id,
                        "deleted": success
                    }
                else:
                    collections_cleaned = True
                    collection_cleanup_details = {
                        "flow_id": flow_id,
                        "user_id": user_id,
                        "message": "Collection did not exist"
                    }
            except Exception as e:
                collection_cleanup_error = str(e)
                print(f"Error cleaning up collection for flow {flow_id}: {e}")

            return FlowDeletionResult(
                success=True,
                flow_id=flow_id,
                message=f"Flow '{flow_id}' deleted successfully",
                collections_cleaned=collections_cleaned,
                collection_cleanup_details=collection_cleanup_details,
                collection_cleanup_error=collection_cleanup_error
            )

        except Exception as e:
            return FlowDeletionResult(
                success=False,
                flow_id=flow_id,
                message=f"Error deleting flow: {str(e)}"
            )

    async def delete_multiple_flows(
            self,
            request: Request,
            flow_ids: List[str]
    ) -> Dict[str, Any]:
        """Delete multiple flows and their associated collections"""
        token = get_user_token(request)
        if not token:
            raise ValueError("No valid authentication token found")

        results = {
            "success_count": 0,
            "error_count": 0,
            "results": [],
            "collections_cleaned": 0
        }

        for flow_id in flow_ids:
            deletion_result = await self.delete_flow(request, flow_id)

            if deletion_result.success:
                results["success_count"] += 1
                if deletion_result.collections_cleaned:
                    results["collections_cleaned"] += 1
            else:
                results["error_count"] += 1

            results["results"].append(deletion_result.dict())

        return results

    async def get_public_flows(self) -> List[Dict[str, Any]]:
        """
        Get all flows that have access_type set to PUBLIC
        Uses admin token via JWT helper to access all flows across all users

        Returns:
            List of public flow dictionaries with safe public information
        """
        try:
            admin_token = await get_admin_token(self.langflow_repo)

            all_flows = await self.langflow_repo.get_all_flows_as_admin(admin_token)

            public_flows = []
            for flow in all_flows:
                access_type = flow.get('access_type', 'PRIVATE')

                if access_type.upper() == 'PUBLIC':
                    public_flow = {
                        'id': flow.get('id'),
                        'name': flow.get('name'),
                        'description': flow.get('description'),
                        'updated_at': flow.get('updated_at'),
                        'access_type': access_type,
                        'public_url': f"{LANGFLOW_URL}/public_flow/{flow.get('id')}",
                        'is_public': True,
                        'created_at': flow.get('created_at'),
                        'folder_id': flow.get('folder_id'),
                        'tags': flow.get('tags', []),
                        'endpoint_name': flow.get('endpoint_name'),
                    }
                    public_flows.append(public_flow)

            print(f"Found {len(public_flows)} public flows out of {len(all_flows)} total flows")
            return public_flows

        except ValueError as e:
            print(f"Admin authentication error: {e}")
            return []

        except Exception as e:
            print(f"Error getting all public flows: {e}")
            return []

    async def prepare_flow_execution_payload(self, request: Request, flow_id: str, user_id: str,
                                             message: str, session_id: Optional[str] = None,
                                             tweaks: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Prepare the payload for flow execution, including Qdrant collection name tweaks

        Args:
            request: FastAPI request object
            flow_id: ID of the flow to execute
            user_id: ID of the user to execute
            message: User message to send to the flow
            session_id: Optional session ID for conversation continuity
            tweaks: Optional tweaks to modify flow behavior

        Returns:
            Formatted payload for Langflow API with Qdrant tweaks
        """
        payload = {
            "input_value": message,
            "output_type": "chat",
            "input_type": "chat"
        }

        if session_id:
            payload["session_id"] = session_id

        try:
            component_info = await self.get_flow_component_ids(request, flow_id)
            component_ids = component_info.component_ids

            qdrant_component_ids = [
                comp_id for comp_id in component_ids
                if 'qdrant' in comp_id.lower()
            ]

            print(f"Found {len(component_ids)} total components")
            print(f"Found {len(qdrant_component_ids)} Qdrant components: {qdrant_component_ids}")

            auto_tweaks = {}
            collection_name = get_collection_name(user_id, flow_id)
            if qdrant_component_ids:
                for qdrant_id in qdrant_component_ids:
                    auto_tweaks[qdrant_id] = {
                        "collection_name": collection_name
                    }
                print(f"Added collection_name tweaks for Qdrant components: {list(auto_tweaks.keys())}")

            if tweaks:
                auto_tweaks.update(tweaks)

            if auto_tweaks:
                payload["tweaks"] = auto_tweaks

        except Exception as e:
            print(f"Warning: Could not get component IDs for flow {flow_id}: {e}")
            if tweaks:
                payload["tweaks"] = tweaks

        return payload

    async def execute_flow(
            self,
            request: Request,
            flow_id: str,
            payload: Dict[str, Any]
    ) -> FlowExecutionResult:
        """Execute a flow with given payload"""
        token = get_user_token(request)
        if not token:
            raise ValueError("No valid authentication token found")

        # Validate access first
        has_access = await self.validate_user_flow_access(request, flow_id)
        if not has_access:
            raise ValueError(f"Flow '{flow_id}' not found or access denied")

        # Create temporary API key for execution
        api_key_response = await self.langflow_repo.create_api_key(
            token=token,
            name=f"temp_execution_{flow_id}",
            description="Temporary key for flow execution"
        )

        api_key = api_key_response.get("api_key")
        api_key_id = api_key_response.get("id")

        try:
            response = await self.langflow_repo.run_flow(flow_id, payload, api_key)

            return FlowExecutionResult(
                success=True,
                flow_id=flow_id,
                session_id=payload.get("session_id", ""),
                response=response.extracted_message,
                raw_response=response.raw_response
            )

        except Exception as e:
            return FlowExecutionResult(
                success=False,
                flow_id=flow_id,
                session_id=payload.get("session_id", ""),
                response="",
                error=str(e)
            )
        finally:
            if api_key_id:
                await self.langflow_repo.delete_api_key(token, api_key_id)

    async def create_collection_for_flow(
            self,
            request: Request,
            flow_id: str
    ) -> CollectionCreateResponse:
        """Create a new Qdrant collection using flow_id as collection name"""
        user_id = await get_user_id_from_request(request)
        if not user_id:
            raise ValueError("No valid authentication token found")

        if not flow_id.strip():
            raise ValueError("Flow ID cannot be empty")

        has_access = await self.validate_user_flow_access(request, flow_id)
        if not has_access:
            raise ValueError(f"Access denied: You don't have permission to access flow '{flow_id}'")

        if await self.qdrant_repo.collection_exists(user_id, flow_id):
            collection_info = await self.qdrant_repo.get_collection_info(user_id, flow_id)
            return CollectionCreateResponse(
                success=True,
                message="Collection already exists",
                collection=collection_info,
                created=False
            )

        vector_size = await self.ollama_repo.get_vector_size()

        collection_info = await self.qdrant_repo.create_collection(user_id, flow_id, vector_size)

        return CollectionCreateResponse(
            success=True,
            message="Collection created successfully",
            collection=collection_info,
            created=True
        )

    async def delete_collection_for_flow(
            self,
            request: Request,
            flow_id: str
    ) -> Dict[str, Any]:
        """Delete a collection by flow_id"""
        user_id = await get_user_id_from_request(request)
        if not user_id:
            raise ValueError("No valid authentication token found")

        if not flow_id.strip():
            raise ValueError("Flow ID cannot be empty")

        has_access = await self.validate_user_flow_access(request, flow_id)
        if not has_access:
            raise ValueError(f"Access denied: You don't have permission to access flow '{flow_id}'")

        if not await self.qdrant_repo.collection_exists(user_id, flow_id):
            raise ValueError(f"Collection for flow '{flow_id}' not found")

        success = await self.qdrant_repo.delete_collection(user_id, flow_id)

        if not success:
            raise ValueError(f"Failed to delete collection for flow '{flow_id}'")

        return {
            "success": True,
            "message": f"Collection for flow '{flow_id}' deleted successfully",
            "flow_id": flow_id,
            "user_id": user_id
        }

    async def list_collection_files(
            self,
            request: Request,
            flow_id: str
    ) -> CollectionFilesResponse:
        """List all files in a specific collection using flow_id"""
        user_id = await get_user_id_from_request(request)
        if not user_id:
            raise ValueError("No valid authentication token found")

        if not flow_id.strip():
            raise ValueError("Flow ID cannot be empty")

        has_access = await self.validate_user_flow_access(request, flow_id)
        if not has_access:
            raise ValueError(f"Access denied: You don't have permission to access flow '{flow_id}'")

        if not await self.qdrant_repo.collection_exists(user_id, flow_id):
            raise ValueError(f"Collection for flow '{flow_id}' not found")

        files_data = await self.qdrant_repo.get_files_in_collection(user_id, flow_id)

        files = []
        for file_data in files_data:
            file_info = FileInfo(
                file_id=file_data.get("file_id", ""),
                file_path=file_data.get("file_path", ""),
                file_name=file_data.get("file_name", ""),
                file_type=file_data.get("file_type", ""),
                flow_id=flow_id,
                file_size=file_data.get("file_size"),
                includes_images=file_data.get("includes_images", True),
                processing=processing_tracker.is_processing(file_data.get("file_id", ""))
            )
            files.append(file_info)

        collection_name = get_collection_name(user_id, flow_id)

        return CollectionFilesResponse(
            success=True,
            flow_id=flow_id,
            collection_name=collection_name,
            files=files,
            total_files=len(files)
        )

    async def upload_file_to_collection(
            self,
            request: Request,
            flow_id: str,
            file: UploadFile,
            background_tasks: BackgroundTasks,
            chunk_size: int = 1000,
            chunk_overlap: int = 200,
            include_images: bool = True,
    ) -> FileUploadResponse:
        """Upload a file to a specific collection using flow_id with background processing"""
        user_id = await get_user_id_from_request(request)
        if not user_id:
            raise ValueError("No valid authentication token found")

        if not file.filename:
            raise ValueError("No filename provided")

        if not flow_id.strip():
            raise ValueError("Flow ID cannot be empty")

        has_access = await self.validate_user_flow_access(request, flow_id)
        if not has_access:
            raise ValueError(f"Access denied: You don't have permission to access flow '{flow_id}'")

        # Ensure collection exists
        if not await self.qdrant_repo.collection_exists(user_id, flow_id):
            raise ValueError(f"Collection for flow '{flow_id}' not found. Please create the collection first.")

        upload_dir = Path(BACKEND_UPLOAD_DIR) / flow_id
        upload_dir.mkdir(parents=True, exist_ok=True)

        file_id = str(uuid.uuid4())
        safe_filename = f"{file_id}_{file.filename}"
        file_path = upload_dir / safe_filename

        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        except Exception as e:
            raise ValueError(f"Failed to save file: {str(e)}")

        if await self.qdrant_repo.check_file_exists(user_id, flow_id, str(file_path)):
            file_path.unlink(missing_ok=True)
            raise ValueError(f"File '{file.filename}' already exists in collection for flow '{flow_id}'")

        print(f"✅ File saved to: {file_path}")
        print(f"📁 File size: {file_path.stat().st_size} bytes")

        file_size = file_path.stat().st_size

        file_info = FileInfo(
            file_id=file_id,
            file_path=str(file_path),
            file_name=file.filename,
            file_type="unknown",
            flow_id=flow_id,
            file_size=file_size,
            includes_images=include_images,
            processing=True
        )

        processing_tracker.add_file(file_id, file_info.dict())

        background_tasks.add_task(
            self._process_file_background_wrapper,
            file_path=str(file_path),
            file_name=file.filename,
            file_size=file_size,
            file_id=file_id,
            user_id=user_id,
            flow_id=flow_id,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            include_images=include_images
        )

        print(f"🚀 Background task added for file: {file_id}")

        return FileUploadResponse(
            success=True,
            message=f"File '{file.filename}' uploaded successfully and is being processed in the background",
            file_info=file_info
        )

    def _process_file_background_wrapper(
            self,
            file_path: str,
            file_name: str,
            file_size: int,
            file_id: str,
            user_id: str,
            flow_id: str,
            chunk_size: int,
            chunk_overlap: int,
            include_images: bool
    ):
        """
        Wrapper for background processing that handles the sync/async conversion
        This function runs in the background task
        """
        try:
            asyncio.run(self._process_file_background_async(
                file_path, file_name, file_size, file_id, user_id, flow_id,
                chunk_size, chunk_overlap, include_images
            ))
        except Exception as e:
            print(f"❌ Error in background wrapper: {e}")
            processing_tracker.update_file(file_id, {
                "status": "failed",
                "error": f"Background processing error: {str(e)}"
            })
            try:
                Path(file_path).unlink(missing_ok=True)
            except:
                pass

    async def _process_file_background_async(
            self,
            file_path: str,
            file_name: str,
            file_size: int,
            file_id: str,
            user_id: str,
            flow_id: str,
            chunk_size: int,
            chunk_overlap: int,
            include_images: bool
    ):
        """
        Actual async background processing method
        """
        try:
            print(f"🔄 Starting background processing for file: {file_path}")
            processing_tracker.update_file(file_id, {"status": "reading_file"})

            try:
                content, file_type = read_file_content(file_path, include_images)
                print(f"📄 File type detected: {file_type}")
                print(f"📊 Content length: {len(content)} characters")
            except Exception as e:
                raise ValueError(f"Failed to read file content: {str(e)}")

            processing_tracker.update_file(file_id, {
                "file_type": file_type,
                "status": "creating_chunks"
            })

            chunks = []
            for i in range(0, len(content), chunk_size - chunk_overlap):
                chunk = content[i:i + chunk_size]
                if chunk.strip():
                    chunks.append(chunk)

            print(f"Created {len(chunks)} chunks")
            processing_tracker.update_file(file_id, {
                "status": "generating_embeddings",
                "total_chunks": len(chunks)
            })

            document_chunks = []
            for chunk_idx, chunk in enumerate(chunks):
                if chunk_idx % 5 == 0:
                    print(f"⚡ Processing chunk {chunk_idx + 1}/{len(chunks)}")
                    processing_tracker.update_file(file_id, {
                        "current_chunk": chunk_idx + 1
                    })

                try:
                    embedding = get_text_embedding(chunk)

                    metadata = DocumentMetadata(
                        file_path=file_path,
                        file_id=file_id,
                        file_size=file_size,
                        filename=file_name,
                        file_type=file_type,
                        flow_id=flow_id,
                        chunk_idx=chunk_idx,
                        includes_images=include_images,
                        uploaded_at=datetime.utcnow()
                    )

                    doc_chunk = DocumentChunk(
                        content=chunk,
                        embedding=embedding,
                        metadata=metadata
                    )
                    document_chunks.append(doc_chunk)

                except Exception as e:
                    print(f"❌ Error processing chunk {chunk_idx}: {e}")
                    continue

            if not document_chunks:
                raise ValueError("No valid chunks were created from the file")

            print(f"🎯 Successfully created {len(document_chunks)} document chunks")
            processing_tracker.update_file(file_id, {
                "status": "uploading_to_qdrant",
                "chunks_created": len(document_chunks)
            })

            success = await self.qdrant_repo.upload_documents(user_id, flow_id, document_chunks)

            if success:
                print(f"✅ Successfully uploaded {len(document_chunks)} chunks to Qdrant")
                processing_tracker.remove_file(file_id)
                try:
                    Path(file_path).unlink(missing_ok=True)
                    print(f"🗑️ Cleaned up file: {file_path}")
                except Exception as e:
                    print(f"⚠️ Could not delete file {file_path}: {e}")
            else:
                raise ValueError("Failed to upload chunks to Qdrant")

        except Exception as e:
            print(f"❌ Error processing file in background: {e}")
            processing_tracker.update_file(file_id, {
                "status": "failed",
                "error": str(e)
            })
            try:
                Path(file_path).unlink(missing_ok=True)
            except:
                pass

    async def delete_file_from_collection(
            self,
            request: Request,
            flow_id: str,
            file_path: str
    ) -> FileDeletionResponse:
        """Delete a specific file from a collection using flow_id"""
        user_id = await get_user_id_from_request(request)
        if not user_id:
            raise ValueError("No valid authentication token found")

        if not flow_id.strip():
            raise ValueError("Flow ID cannot be empty")

        # Validate user has access to this flow
        has_access = await self.validate_user_flow_access(request, flow_id)
        if not has_access:
            raise ValueError(f"Access denied: You don't have permission to access flow '{flow_id}'")

        # Check if collection exists
        if not await self.qdrant_repo.collection_exists(user_id, flow_id):
            raise ValueError(f"Collection for flow '{flow_id}' not found")

        # Check if file exists in collection
        if not await self.qdrant_repo.check_file_exists(user_id, flow_id, file_path):
            raise ValueError(f"File not found in collection for flow '{flow_id}'")

        # Delete file from Qdrant
        deleted_count = await self.qdrant_repo.delete_documents_by_file_path(user_id, flow_id, file_path)

        # Delete physical file
        physical_file_deleted = False
        file_path_obj = Path(file_path)
        if file_path_obj.exists():
            try:
                file_path_obj.unlink()
                print(f"Deleted physical file: {file_path_obj}")
                physical_file_deleted = True
            except Exception as e:
                print(f"Warning: Could not delete physical file {file_path_obj}: {e}")

        collection_name = get_collection_name(user_id, flow_id)

        return FileDeletionResponse(
            success=True,
            message=f"File deleted successfully from collection for flow '{flow_id}'",
            file_path=file_path,
            flow_id=flow_id,
            collection_name=collection_name,
            qdrant_deleted=deleted_count > 0,
            physical_file_deleted=physical_file_deleted
        )

    async def get_collection_details(
            self,
            request: Request,
            flow_id: str
    ) -> Dict[str, Any]:
        """Get detailed information about a collection"""
        user_id = await get_user_id_from_request(request)
        if not user_id:
            raise ValueError("No valid authentication token found")

        if not flow_id.strip():
            raise ValueError("Flow ID cannot be empty")

        # Validate user has access to this flow
        has_access = await self.validate_user_flow_access(request, flow_id)
        if not has_access:
            raise ValueError(f"Access denied: You don't have permission to access flow '{flow_id}'")

        # Check if collection exists and get info
        if not await self.qdrant_repo.collection_exists(user_id, flow_id):
            raise ValueError(f"Collection for flow '{flow_id}' not found")

        collection_info = await self.qdrant_repo.get_collection_info(user_id, flow_id)

        return {
            "success": True,
            "flow_id": flow_id,
            "collection": collection_info.dict() if collection_info else None
        }
