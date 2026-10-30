-- 1. Dar permisos para usar el schema budget
GRANT USAGE ON SCHEMA budget TO anon, authenticated, service_role;

-- 2. Dar permisos para ejecutar todas las funciones actuales (RPC) dentro del schema budget
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA budget TO anon, authenticated, service_role;

-- 3. (Opcional por si creas más funciones en el futuro) Asegurar que las futuras funciones también tengan permisos automáticamente
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA budget 
GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

-- 4. Dar permisos sobre las tablas/vistas del schema (por si tu función lee o escribe en tablas de ahí)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA budget TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA budget 
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;