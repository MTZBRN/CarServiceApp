import { createBrowserRouter, Navigate } from "react-router-dom";
import App, { DashboardRoute, CalendarRoute } from "../App";
import { LoginRoute, RequireAuth, RequireAdmin } from "./RouteGuards";
import VehicleDetailsRoute from "./VehicleDetailsRoute";
import Garage from "../components/Pages/Garage";
import Customers from "../components/Pages/Customers";
import Inventory from "../components/Pages/Inventory";
import Settings from "../components/Pages/Settings";
import UserManagement from "../components/Pages/UserManagement";
export const router = createBrowserRouter([
    { path: "/login", element: <LoginRoute /> },
    { element: <RequireAuth />, children: [{ element: <App />, children: [
                    { index: true, element: <Navigate to="/dashboard" replace/> },
                    { path: "dashboard", element: <DashboardRoute /> },
                    { path: "calendar", element: <CalendarRoute /> },
                    { path: "customers", element: <Customers /> },
                    { path: "vehicles", element: <Garage /> },
                    { path: "vehicles/:vehicleId", element: <VehicleDetailsRoute /> },
                    { path: "inventory", element: <Inventory /> },
                    { element: <RequireAdmin />, children: [
                            { path: "users", element: <UserManagement /> },
                            { path: "settings", element: <Settings /> },
                        ] },
                    { path: "*", element: <div role="alert">Az oldal nem található.</div> },
                ] }] },
]);
