"""
AIR QUALITY INTELLIGENCE - Procesamiento y análisis de datos en Python.

Lee la base de datos SQLite que genera la aplicación y calcula:
  * comparación antes / después por contaminante,
  * porcentaje de reducción y resultado de los tratamientos,
  * modelo predictivo (regresión lineal) del tiempo de purificación,
  * exportación de la vista analítica a CSV para Power BI / Excel.

Solo usa la librería estándar (sqlite3, csv, statistics).
Uso:  python analisis/analisis_calidad_aire.py
"""
import csv
import sqlite3
import statistics as st
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DB = RAIZ / "data" / "airquality.db"
SALIDA = RAIZ / "docs" / "v_comparacion.csv"
CONTAMINANTES = {"pm25": "PM2.5 (µg/m³)", "pm10": "PM10 (µg/m³)", "co2": "CO2 (ppm)", "co": "CO (ppm)", "tvoc": "COV (mg/m³)"}


def regresion_lineal(xs, ys):
    """Mínimos cuadrados: y = a + b·x, devuelve (a, b, r2)."""
    mx, my = st.mean(xs), st.mean(ys)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    sxx = sum((x - mx) ** 2 for x in xs)
    syy = sum((y - my) ** 2 for y in ys)
    b = sxy / sxx
    a = my - b * mx
    r2 = (sxy * sxy) / (sxx * syy) if syy else 1.0
    return a, b, r2


def main():
    if not DB.exists():
        raise SystemExit("No existe data/airquality.db. Ejecute primero: npm run seed")
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    filas = [dict(r) for r in con.execute("SELECT * FROM v_comparacion WHERE proceso_id IS NOT NULL")]
    print(f"Tratamientos analizados: {len(filas)}\n")

    print(f"{'Contaminante':<16}{'Antes':>10}{'Después':>10}{'Reducción %':>14}")
    for clave, nombre in CONTAMINANTES.items():
        antes = st.mean(f[clave + "_ini"] for f in filas)
        despues = st.mean(f[clave + "_fin"] for f in filas)
        red = st.mean(f["red_" + clave] for f in filas)
        print(f"{nombre:<16}{antes:>10.2f}{despues:>10.2f}{red:>14.1f}")

    print("\nResultado de los tratamientos")
    for res in ("Óptimo", "Aceptable", "Insuficiente"):
        n = sum(1 for f in filas if f["resultado"] == res)
        print(f"  {res:<13}{n:>4}  ({n / len(filas) * 100:.1f} %)")

    hepa = [f for f in filas if "HEPA" in f["filtros"] and f["nivel_fin"] == 1]
    a, b, r2 = regresion_lineal([f["pm25_ini"] for f in hepa], [f["duracion_real_min"] for f in hepa])
    print(f"\nModelo predictivo: tiempo = {a:.2f} + {b:.3f} x PM2.5_inicial   (R2 = {r2:.3f}, n = {len(hepa)})")
    for pm in (30, 100, 250):
        print(f"  PM2.5 inicial {pm:>3} µg/m³ -> {a + b * pm:5.1f} min estimados")

    with open(SALIDA, "w", newline="", encoding="utf-8-sig") as fh:
        todas = [dict(r) for r in con.execute("SELECT * FROM v_comparacion")]
        w = csv.DictWriter(fh, fieldnames=list(todas[0].keys()), delimiter=";")
        w.writeheader()
        w.writerows(todas)
    print(f"\nVista analítica exportada a {SALIDA}")


if __name__ == "__main__":
    main()
