/**
 * Umbrales y parámetros del semáforo.
 * Son EDITABLES: la EPS los calibra sin tocar el motor.
 * Valores provisionales; se calibran con los cortes de 2017 y 2023 (DS03) y con EPS Grau.
 * En producción se leerán de la base (tabla `reglas`) en vez de este archivo.
 */
export const reglas = {
  // Caudal del río Piura en la estación Sánchez Cerro (m³/s). Fuente: prensa local con umbrales de SENAMHI; por confirmar.
  caudal: { amarillo: 900, naranja: 1290, rojo: 1900 },

  // Lluvia acumulada en 24 h en la cuenca (mm). Supuesto inicial.
  lluvia24h: { amarillo: 20, naranja: 40, rojo: 80 },

  // Turbiedad del agua cruda a la entrada de la planta (NTU). Parámetro por planta, calibrable.
  turbiedad: { alta: 1000, critica: 3000 },

  // Autonomía en horas que define cada nivel.
  autonomiaH: { amarillo: 72, naranja: 48, rojo: 24 },

  // Nivel del reservorio (%) considerado crítico.
  reservorioCriticoPct: 30,

  // Duración típica del corte según la causa (h). Medianas de DS03 (simulado) o supuestos.
  duracionCorteH: { captacion: 87, linea: 110, pozo: 91, turbiedad: 36, energia: 12 },

  // Fracción de producción que se pierde con cada problema.
  perdidaProduccion: { turbiedadAlta: 0.5, turbiedadCritica: 1, sinEnergia: 0.4 },

  // Pérdidas físicas de la red (fracción). Supuesto editable.
  perdidasRed: 0.35,

  // Cisternas
  cisterna: { capacidadM3: 20, viajesPorDia: 4, fraccionPrioritaria: 0.15 },

  // En zonas de vulnerabilidad alta se sube un nivel antes ("sin arrepentimiento").
  vulnerabilidadAlta: 0.6,

  // Semáforo sanitario "¿Es segura el agua?"
  sanitario: {
    cloroMinMgL: 0.5, // cloro residual libre mínimo en red. D.S. N.º 031-2010-SA, por confirmar.
    cloroCriticoMgL: 0.2, // por debajo: no tomar del caño. Supuesto.
    turbiedadRedMaxNTU: 5, // límite en red (D.S. N.º 031-2010-SA, por confirmar).
    turbiedadRedAvisoNTU: 2, // aviso temprano. Supuesto.
    corteAlmacenamientoH: 24, // con cortes más largos los hogares almacenan agua: más riesgo. Supuesto.
  },
} as const

export type Reglas = typeof reglas
