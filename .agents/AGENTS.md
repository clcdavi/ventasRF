# Reglas de Despliegue para ventasRF

Siempre que el usuario solicite "actualizar el servidor", "deployar", "subir los cambios" o cualquier frase similar que implique actualizar la plataforma en producción, debes seguir estrictamente los siguientes pasos automatizados sin preguntarle de nuevo:

1. **Commit y Push Local:** Haz commit y push de todos los cambios locales a la rama principal (usando `git add . && git commit -m "..." && git push`).
2. **Conexión SSH y Despliegue:** Conéctate al VPS de Oracle Cloud por SSH usando su llave privada guardada en local y ejecuta los comandos necesarios para bajar el código y reconstruir el contenedor web de Docker, ya que este es el que sirve tanto el backend (Python) como los estáticos compilados (Móvil Web y Frontend Dashboard).

Comando de despliegue consolidado a ejecutar con `run_command` (sin preguntar):

```bash
ssh -o StrictHostKeyChecking=no -i /Users/davidcorrea/Downloads/ssh-key-2026-05-16.key ubuntu@137.131.245.249 "cd ventasRF && git pull origin main && docker-compose rm -fs web && docker-compose up -d --build web"
```

*Nota: Asegúrate de reconstruir también los estáticos de Expo (`npm run web` o `npx expo export -p web` en la carpeta `mobile/`) ANTES de hacer el commit y conectarte por SSH, si es que hubo modificaciones en los archivos de la app móvil.*
