from pydantic import BaseModel, Field
from uuid import UUID
from typing import List, Dict, Any

class GraphNode(BaseModel):
    id: str = Field(..., description="Node identifier")
    data: Dict[str, Any] = Field(default_factory=dict, description="Arbitrary node data")

class GraphEdge(BaseModel):
    source: str = Field(..., description="Source node id")
    target: str = Field(..., description="Target node id")
    relationship: str = Field(..., description="Relationship type")

class GraphResponse(BaseModel):
    incident_id: UUID = Field(..., description="Incident UUID for which the graph is returned")
    nodes: List[GraphNode] = Field(default_factory=list, description="List of graph nodes")
    edges: List[GraphEdge] = Field(default_factory=list, description="List of graph edges")
