import math
from datetime import datetime, timezone
from typing import Any, Optional, Tuple

from app.models.sentinel import AnomalyRecord, AnomalyType, ConcernLevel, TravelMode


def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great circle distance between two points on the earth in meters."""
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def cross_track_distance_meters(
    curr_lat: float, curr_lon: float,
    start_lat: float, start_lon: float,
    dest_lat: float, dest_lon: float
) -> float:
    """Calculate distance of current point from the line between start and destination."""
    R = 6371000.0
    dist_start_curr = haversine_distance_meters(start_lat, start_lon, curr_lat, curr_lon) / R
    if dist_start_curr == 0.0:
        return 0.0

    # Initial bearing from start to destination
    lat1, lon1 = math.radians(start_lat), math.radians(start_lon)
    lat2, lon2 = math.radians(dest_lat), math.radians(dest_lon)
    lat3, lon3 = math.radians(curr_lat), math.radians(curr_lon)

    d_lon_12 = lon2 - lon1
    y12 = math.sin(d_lon_12) * math.cos(lat2)
    x12 = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(d_lon_12)
    bearing_12 = math.atan2(y12, x12)

    # Initial bearing from start to current
    d_lon_13 = lon3 - lon1
    y13 = math.sin(d_lon_13) * math.cos(lat3)
    x13 = math.cos(lat1) * math.sin(lat3) - math.sin(lat1) * math.cos(lat3) * math.cos(d_lon_13)
    bearing_13 = math.atan2(y13, x13)

    xt = math.asin(math.sin(dist_start_curr) * math.sin(bearing_13 - bearing_12))
    return abs(xt) * R


class AnomalyDetectionEngine:
    """Configurable, explainable rules-based safety anomaly engine."""

    SPEED_LIMITS_KMH = {
        TravelMode.WALKING: 14.0,   # Running is ~10-12 km/h; >14 km/h suggests vehicle forced entry
        TravelMode.TRANSIT: 110.0,
        TravelMode.DRIVING: 140.0,
        TravelMode.OTHER: 80.0,
    }

    def evaluate_location_update(
        self,
        session: dict[str, Any],
        update: dict[str, Any],
        location_history: list[dict[str, Any]],
    ) -> Tuple[Optional[AnomalyRecord], ConcernLevel]:
        """Evaluate a new location update against the active journey session.

        Returns (Optional[AnomalyRecord], updated ConcernLevel).
        """
        curr_lat = update["latitude"]
        curr_lng = update["longitude"]
        curr_acc = update.get("accuracy") or 20.0
        now = update.get("timestamp") or datetime.now(timezone.utc)

        # Ignore evaluation if accuracy is unacceptable (> 150m GPS cloud drift)
        if curr_acc > 150.0:
            return None, ConcernLevel(session.get("concern_level", "normal"))

        anomalies_found: list[AnomalyRecord] = []

        # 1. Route Deviation Check
        start_lat = session.get("start_lat")
        start_lng = session.get("start_lng")
        dest_lat = session.get("destination_lat")
        dest_lng = session.get("destination_lng")
        threshold = session.get("deviation_threshold_meters") or 200.0

        if start_lat is not None and start_lng is not None and dest_lat is not None and dest_lng is not None:
            # Check deviation from corridor
            deviation = cross_track_distance_meters(curr_lat, curr_lng, start_lat, start_lng, dest_lat, dest_lng)
            # Adjust effective threshold for GPS accuracy buffer
            effective_threshold = threshold + (curr_acc * 0.5)

            if deviation > effective_threshold:
                anomalies_found.append(
                    AnomalyRecord(
                        session_id=session["id"],
                        anomaly_type=AnomalyType.ROUTE_DEVIATION,
                        severity="medium" if deviation < effective_threshold * 1.8 else "high",
                        detected_at=now,
                        reason=f"Current position is {int(deviation)}m off planned corridor (threshold: {int(threshold)}m).",
                        confidence=0.88,
                        rule_triggered=f"cross_track_deviation > {int(threshold)}m",
                        location={"latitude": curr_lat, "longitude": curr_lng, "accuracy": curr_acc},
                    )
                )

        # 2. Speed Anomaly Check
        mode = TravelMode(session.get("travel_mode", "walking"))
        max_speed = self.SPEED_LIMITS_KMH.get(mode, 14.0)

        # Calculate speed if previous location exists
        if location_history:
            prev = location_history[-1]
            time_diff = (now - prev["timestamp"]).total_seconds()
            if time_diff >= 3.0:  # Minimum 3s interval to prevent division spike
                dist = haversine_distance_meters(
                    prev["latitude"], prev["longitude"],
                    curr_lat, curr_lng
                )
                speed_mps = dist / time_diff
                speed_kmh = speed_mps * 3.6

                if speed_kmh > max_speed:
                    anomalies_found.append(
                        AnomalyRecord(
                            session_id=session["id"],
                            anomaly_type=AnomalyType.SPEED_ANOMALY,
                            severity="high" if mode == TravelMode.WALKING else "medium",
                            detected_at=now,
                            reason=f"Recorded movement at {int(speed_kmh)} km/h exceeds expected {mode.value} threshold ({int(max_speed)} km/h).",
                            confidence=0.85,
                            rule_triggered=f"speed_kmh > {int(max_speed)} km/h for {mode.value}",
                            location={"latitude": curr_lat, "longitude": curr_lng, "accuracy": curr_acc},
                        )
                    )

        # 3. Unexpected Stop Check (dwelling outside destination)
        if len(location_history) >= 4 and dest_lat is not None and dest_lng is not None:
            dist_to_dest = haversine_distance_meters(curr_lat, curr_lng, dest_lat, dest_lng)
            # If not yet within 100m of destination
            if dist_to_dest > 100.0:
                oldest_in_window = location_history[-4]
                window_duration = (now - oldest_in_window["timestamp"]).total_seconds()
                drift = haversine_distance_meters(
                    oldest_in_window["latitude"], oldest_in_window["longitude"],
                    curr_lat, curr_lng
                )
                # Stationary for >= 180 seconds with drift < 35m
                if window_duration >= 180.0 and drift < 35.0:
                    anomalies_found.append(
                        AnomalyRecord(
                            session_id=session["id"],
                            anomaly_type=AnomalyType.UNEXPECTED_STOP,
                            severity="medium",
                            detected_at=now,
                            reason=f"Prolonged stop detected ({int(window_duration / 60)} mins) en route, {int(dist_to_dest)}m from destination.",
                            confidence=0.80,
                            rule_triggered="stationary_duration >= 180s outside destination buffer",
                            location={"latitude": curr_lat, "longitude": curr_lng, "accuracy": curr_acc},
                        )
                    )

        # 4. Journey Timeout Check
        exp_arrival = session.get("expected_arrival")
        if exp_arrival and now > exp_arrival:
            overdue_mins = int((now - exp_arrival).total_seconds() / 60)
            if overdue_mins >= 2:
                anomalies_found.append(
                    AnomalyRecord(
                        session_id=session["id"],
                        anomaly_type=AnomalyType.JOURNEY_TIMEOUT,
                        severity="high",
                        detected_at=now,
                        reason=f"Journey overdue by {overdue_mins} minutes beyond expected arrival time.",
                        confidence=0.95,
                        rule_triggered="now > expected_arrival + 2m",
                        location={"latitude": curr_lat, "longitude": curr_lng, "accuracy": curr_acc},
                    )
                )

        if not anomalies_found:
            return None, ConcernLevel.NORMAL

        # Select highest severity anomaly
        primary_anomaly = max(anomalies_found, key=lambda a: {"critical": 4, "high": 3, "medium": 2, "low": 1}[a.severity])

        if len(anomalies_found) >= 2 or primary_anomaly.severity == "critical":
            concern = ConcernLevel.CRITICAL
        elif primary_anomaly.severity == "high":
            concern = ConcernLevel.WARNING
        elif primary_anomaly.severity == "medium":
            concern = ConcernLevel.ADVISORY
        else:
            concern = ConcernLevel.NORMAL

        return primary_anomaly, concern
