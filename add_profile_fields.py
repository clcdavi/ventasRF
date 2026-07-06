import sqlite3
import os

def migrate():
    db_path = 'ventasRF.db'
    if not os.path.exists(db_path):
        print("Error: Database not found")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        cursor.execute("ALTER TABLE usuarios ADD COLUMN telefono TEXT;")
        print("Columna 'telefono' añadida a 'usuarios'.")
    except sqlite3.OperationalError as e:
        print(f"Error añadiendo 'telefono': {e}")
        
    try:
        cursor.execute("ALTER TABLE usuarios ADD COLUMN direccion TEXT;")
        print("Columna 'direccion' añadida a 'usuarios'.")
    except sqlite3.OperationalError as e:
        print(f"Error añadiendo 'direccion': {e}")

    conn.commit()
    conn.close()
    print("Migración completada.")

if __name__ == '__main__':
    migrate()
