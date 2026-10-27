import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/api";
import type { Vehicle } from "../types";
import VehicleDetails from "../components/Pages/VehicleDetails";
export default function VehicleDetailsRoute() {
    const { vehicleId } = useParams();
    const navigate = useNavigate();
    const [vehicle, setVehicle] = useState<Vehicle | null>(null);
    const [error, setError] = useState("");
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        let active = true;
        setVehicle(null);
        setError("");
        if (!vehicleId || !/^\d+$/.test(vehicleId)) {
            setError("A jármű nem található.");
            return;
        }
        api.get<Vehicle>("/Vehicle/" + vehicleId).then(r => { if (active)
            setVehicle(r.data); }).catch(e => { if (active)
            setError(e.response?.status === 404 ? "A jármű nem található." : "A jármű betöltése nem sikerült."); });
        return () => { active = false; };
    }, [vehicleId, attempt]);
    if (error)
        return <div role="alert">{error} <button onClick={() => setAttempt(a => a + 1)}>Újrapróbálás</button></div>;
    if (!vehicle)
        return <div role="status">Betöltés...</div>;
    return <VehicleDetails key={vehicle.id} vehicle={vehicle} onBack={() => navigate("/vehicles")}/>;
}
