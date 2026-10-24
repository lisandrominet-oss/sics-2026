import BarraSuperior from "./_components/BarraSuperior";
import Hoja01Portada from "./_hojas/Hoja01Portada";
import Hoja02Problema from "./_hojas/Hoja02Problema";
import Hoja03QueEs from "./_hojas/Hoja03QueEs";
import Hoja04Pedir from "./_hojas/Hoja04Pedir";
import Hoja05Circuito from "./_hojas/Hoja05Circuito";
import Hoja06Roles from "./_hojas/Hoja06Roles";
import Hoja07Permisos from "./_hojas/Hoja07Permisos";
import Hoja08Trazabilidad from "./_hojas/Hoja08Trazabilidad";
import Hoja09Modulos from "./_hojas/Hoja09Modulos";
import Hoja10Cierre from "./_hojas/Hoja10Cierre";

const TOTAL = 10;

// Presentación de SICS: 10 hojas A4 verticales. Está detrás del login (middleware), como el resto de la app.
export default function PresentacionPage() {
  return (
    <>
      <BarraSuperior total={TOTAL} />
      <main className="pres-lista">
        <Hoja01Portada total={TOTAL} />
        <Hoja02Problema total={TOTAL} />
        <Hoja03QueEs total={TOTAL} />
        <Hoja04Pedir total={TOTAL} />
        <Hoja05Circuito total={TOTAL} />
        <Hoja06Roles total={TOTAL} />
        <Hoja07Permisos total={TOTAL} />
        <Hoja08Trazabilidad total={TOTAL} />
        <Hoja09Modulos total={TOTAL} />
        <Hoja10Cierre total={TOTAL} />
      </main>
    </>
  );
}
