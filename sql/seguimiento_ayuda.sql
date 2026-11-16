-- Ejecutar UNA sola vez dentro de la base `biovolt` de TiDB.
-- Conserva intacta la tabla solicitudes_ayuda y sus tickets.
CREATE TABLE IF NOT EXISTS seguimiento_ayuda (
  id_seguimiento BIGINT NOT NULL AUTO_INCREMENT,
  id_solicitud INT NOT NULL,
  responsable VARCHAR(80) NOT NULL DEFAULT '',
  nota VARCHAR(500) NOT NULL,
  registrado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_seguimiento),
  INDEX idx_seguimiento_solicitud (id_solicitud, registrado_en)
);
