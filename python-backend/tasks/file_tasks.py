import os
import json
import logging
from pathlib import Path
from typing import List, Dict, Any

class FileTasks:
    def __init__(self, base_directory: str = None):
        self.base_directory = Path(base_directory) if base_directory else Path.home() / "JARVIS_Files"
        self.base_directory.mkdir(exist_ok=True)
        
    async def create_document(self, name: str, content: str = "") -> Dict[str, Any]:
        """Create a new document"""
        try:
            file_path = self.base_directory / name
            
            # Ensure file has extension
            if not file_path.suffix:
                file_path = file_path.with_suffix('.txt')
            
            # Create parent directories if needed
            file_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            logging.info(f"Document created: {file_path}")
            return {
                "success": True,
                "message": f"Document '{file_path.name}' created successfully",
                "file_path": str(file_path)
            }
            
        except Exception as e:
            logging.error(f"Error creating document: {e}")
            return {
                "success": False,
                "message": f"Failed to create document: {str(e)}"
            }
    
    async def find_files(self, extension: str = "txt", folder: str = None) -> Dict[str, Any]:
        """Find files with specific extension"""
        try:
            search_path = Path(folder) if folder else self.base_directory
            
            if not search_path.exists():
                return {
                    "success": False,
                    "message": f"Folder '{search_path}' does not exist"
                }
            
            # Clean extension (remove dot if present)
            extension = extension.lstrip('.')
            
            files = list(search_path.rglob(f"*.{extension}"))
            file_list = [str(f.relative_to(search_path)) for f in files]
            
            logging.info(f"Found {len(files)} .{extension} files in {search_path}")
            return {
                "success": True,
                "message": f"Found {len(files)} .{extension} files",
                "files": file_list,
                "count": len(files)
            }
            
        except Exception as e:
            logging.error(f"Error finding files: {e}")
            return {
                "success": False,
                "message": f"Failed to find files: {str(e)}"
            }
    
    async def read_document(self, name: str) -> Dict[str, Any]:
        """Read content of a document"""
        try:
            file_path = self.base_directory / name
            
            if not file_path.exists():
                return {
                    "success": False,
                    "message": f"File '{name}' not found"
                }
            
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            logging.info(f"Document read: {file_path}")
            return {
                "success": True,
                "message": f"Document '{name}' read successfully",
                "content": content,
                "size": len(content)
            }
            
        except Exception as e:
            logging.error(f"Error reading document: {e}")
            return {
                "success": False,
                "message": f"Failed to read document: {str(e)}"
            }
    
    async def delete_document(self, name: str, confirm: bool = False) -> Dict[str, Any]:
        """Delete a document (requires confirmation)"""
        try:
            if not confirm:
                return {
                    "success": False,
                    "message": "Deletion requires confirmation for safety",
                    "requires_confirmation": True
                }
            
            file_path = self.base_directory / name
            
            if not file_path.exists():
                return {
                    "success": False,
                    "message": f"File '{name}' not found"
                }
            
            file_path.unlink()
            
            logging.info(f"Document deleted: {file_path}")
            return {
                "success": True,
                "message": f"Document '{name}' deleted successfully"
            }
            
        except Exception as e:
            logging.error(f"Error deleting document: {e}")
            return {
                "success": False,
                "message": f"Failed to delete document: {str(e)}"
            }