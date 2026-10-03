-- Rol Operativo y estados del filtro del jefe de área. Los valores de enum van en su propia
-- migración: Postgres no deja usarlos en la misma transacción en la que se agregan.
alter type user_role add value if not exists 'operativo';
alter type sic_status add value if not exists 'pendiente_aprobacion_jefe';
alter type sic_status add value if not exists 'rechazada_jefe';
