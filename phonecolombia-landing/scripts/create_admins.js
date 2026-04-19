#!/usr/bin/env node
/*
  scripts/create_admins.js
  Uso:
    - Definir variables de entorno `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`
    - Ejecutar: `node scripts/create_admins.js`

  Nota: ESTE SCRIPT DEBE EJECUTARSE EN UN ENTORNO SEGURO (server),
  nunca expongas la Service Role Key en el frontend.
*/

(async () => {
  try {
    const { createClient } = await import('@supabase/supabase-js');

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Faltan variables de entorno. Define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.');
      process.exit(1);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const users = [
      { email: 'dev@gmail.com', password: 'Sjv22092000*' },
      { email: 'admin@gmail.com', password: 'admin123' },
      { email: 'asesor@gmail.com', password: 'admin123' },
      { email: 'asesor2@gmail.com', password: 'admin123' },
      { email: 'asesor3@gmail.com', password: 'admin123' }
    ];

    for (const u of users) {
      try {
        console.log('\n==> Creando usuario:', u.email);

        // Crear usuario via admin API
        const { data, error } = await supabase.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true
        });

        if (error) {
          console.error('  Error creando usuario (auth):', error.message || error);
          continue;
        }

        // data puede contener user o id según la versión
        const userId = data?.user?.id || data?.id || null;
        if (!userId) {
          console.warn('  Atención: no se obtuvo UID del usuario. Datos devueltos:', JSON.stringify(data));
        } else {
          console.log('  UID:', userId);
        }

        // Insertar en tabla admins (si la tabla existe)
        try {
          const payload = userId ? { id: userId, email: u.email } : { email: u.email };
          const { error: insertError } = await supabase.from('admins').insert([payload]);
          if (insertError) {
            console.error('  Error insertando en admins:', insertError.message || insertError);
          } else {
            console.log('  Insertado en tabla admins (o ya existía).');
          }
        } catch (e) {
          console.error('  Error al insertar en admins:', e.message || e);
        }

        console.log('  Usuario creado con contraseña temporal:', u.password);
        console.log('  Recomendación: obligar cambio de contraseña o notificar al usuario.');
      } catch (e) {
        console.error('  Error inesperado para', u.email, e.message || e);
      }
    }

    console.log('\n-- Finalizado.');
    process.exit(0);
  } catch (err) {
    console.error('Error inicializando script:', err.message || err);
    process.exit(1);
  }
})();
