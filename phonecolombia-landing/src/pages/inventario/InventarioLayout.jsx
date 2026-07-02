import { Navigate, Route, Routes } from "react-router-dom";
import { InventarioSessionProvider } from "../../contexts/InventarioSessionContext.jsx";
import InventarioAdmin from "../InventarioAdmin.jsx";
import InventarioAjustes from "../InventarioAjustes.jsx";
import InventarioDashboard from "../InventarioDashboard.jsx";
import InventarioVentas from "../InventarioVentas.jsx";
import InventarioInformes from "../InventarioInformes.jsx";
import InventarioInformePreview from "../InventarioInformePreview.jsx";
import InventarioRemisionPreview from "../InventarioRemisionPreview.jsx";
import InventarioServicioTecnico from "../InventarioServicioTecnico.jsx";
import InventarioServicioCatalogos from "../InventarioServicioCatalogos.jsx";

export default function InventarioLayout() {
  return (
    <InventarioSessionProvider>
      <Routes>
        <Route path="dashboard" element={<InventarioDashboard />} />
        <Route index element={<InventarioAdmin />} />
        <Route path="ventas" element={<InventarioVentas />} />
        <Route path="informes" element={<InventarioInformes />} />
        <Route path="informes/vista-previa" element={<InventarioInformePreview />} />
        <Route path="remision/vista-previa" element={<InventarioRemisionPreview />} />
        <Route path="servicio-tecnico" element={<InventarioServicioTecnico />} />
        <Route path="servicio-tecnico/catalogos" element={<InventarioServicioCatalogos />} />
        <Route path="ajustes" element={<InventarioAjustes />} />
        <Route path="ajustes/:section" element={<InventarioAjustes />} />
        <Route path="ajustes/colores" element={<Navigate to="/admin/inventario" replace />} />
        <Route path="ajustes/proveedores" element={<Navigate to="/admin/inventario" replace />} />
        <Route path="ajustes/modelos" element={<Navigate to="/admin/inventario" replace />} />
      </Routes>
    </InventarioSessionProvider>
  );
}
