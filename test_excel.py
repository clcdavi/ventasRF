import sys
from app import app, exportar_excel
from flask import g

with app.test_request_context('/api/export'):
    class DummyUser:
        rol = 'admin'
    
    # Mocking the current user
    # In Flask, usually g.user or session is used. Let's patch `obtener_usuario_actual`
    import app as app_module
    app_module.obtener_usuario_actual = lambda: DummyUser()

    response = exportar_excel()
    if response.status_code == 200:
        print("Excel export test passed!")
        sys.exit(0)
    else:
        print(f"Excel export test failed with status {response.status_code}: {response.data}")
        sys.exit(1)
