import uuid
from typing import List, Dict

import networkx as nx

# Approved relationship types
REL_TYPES = {
    "SAME_USER_REPORTED_IDENTIFIER",
    "SIMILAR_MESSAGE_CONTENT",
    "REPEATED_CONTACT_PATTERN",
    "USER_REPORTED_RELATED_EVENT",
}

def _significant_word_overlap(text1: str, text2: str) -> bool:
    # Return True only when at least two distinct words of length >=5 appear in both texts.
    set1 = {w.lower() for w in text1.split() if len(w) >= 5}
    set2 = {w.lower() for w in text2.split() if len(w) >= 5}
    return len(set1.intersection(set2)) >= 2

def build_incident_graph(incidents: List[Dict]) -> Dict:
    """Pure in‑memory graph builder.

    Returns a dict matching the contract: {"nodes": [...], "edges": [...]}
    """
    G = nx.Graph()
    for inc in incidents:
        nid = str(inc.get("id"))
        G.add_node(nid, label=inc.get("title", "Incident"), category=inc.get("category", "general_harassment"))

    for i, a in enumerate(incidents):
        for b in incidents[i+1:]:
            desc_a = a.get("description", "") or ""
            desc_b = b.get("description", "") or ""
            if not desc_a or not desc_b:
                continue
            if _significant_word_overlap(desc_a, desc_b):
                edge_id = str(uuid.uuid4())
                relationship = "SIMILAR_MESSAGE_CONTENT"
                confidence = 0.6  # heuristic for two‑word overlap
                explanation = "Descriptions share multiple significant words."
                G.add_edge(str(a.get("id")), str(b.get("id")),
                           id=edge_id,
                           relationship=relationship,
                           confidence=confidence,
                           explanation=explanation)
    # Serialize
    nodes = [{"id": nid, "label": data["label"], "category": data["category"]} for nid, data in G.nodes(data=True)]
    edges = [{"id": data["id"], "source": u, "target": v, "relationship": data["relationship"],
              "confidence": data["confidence"], "explanation": data["explanation"]}
             for u, v, data in G.edges(data=True)]
    return {"nodes": nodes, "edges": edges}
