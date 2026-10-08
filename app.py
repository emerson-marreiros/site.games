"""Game Arcade - Flask + SQLite. Rode com: python app.py"""
import os
import sqlite3
from contextlib import closing
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)
DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "database.db")

# Catálogo de jogos (id deve casar com as funções em static/js/games.js)
GAMES = [
    {"id": "snake", "name": "Cobrinha", "cats": ["Ação", "Clássicos"], "desc": "Coma, cresça e não bata."},
    {"id": "memory", "name": "Memória", "cats": ["Quebra-cabeça"], "desc": "Encontre os 6 pares no menor tempo."},
    {"id": "ttt", "name": "Jogo da Velha", "cats": ["Clássicos", "Quebra-cabeça"], "desc": "Você (X) contra a IA (O)."},
]
NAMES = {g["id"]: g["name"] for g in GAMES}


def db():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    return con


def init_db():
    with closing(db()) as con, con:
        con.execute("""CREATE TABLE IF NOT EXISTS scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player TEXT NOT NULL, game TEXT NOT NULL, score INTEGER NOT NULL,
            created TIMESTAMP DEFAULT CURRENT_TIMESTAMP)""")


@app.route("/")
def index():
    return render_template("index.html", games=GAMES)


@app.get("/api/leaderboard")
def leaderboard():
    """Top 5 pontuações gerais."""
    with closing(db()) as con:
        rows = con.execute("SELECT player, game, score FROM scores ORDER BY score DESC, id LIMIT 5").fetchall()
    return jsonify([{**dict(r), "game_name": NAMES.get(r["game"], r["game"])} for r in rows])


@app.post("/api/scores")
def add_score():
    d = request.get_json(silent=True) or {}
    player = str(d.get("player", "ANON")).strip()[:12] or "ANON"
    game, score = d.get("game"), d.get("score")
    if game not in NAMES or not isinstance(score, int) or not 0 <= score <= 100000:
        return jsonify(error="Dados inválidos"), 400
    with closing(db()) as con, con:
        con.execute("INSERT INTO scores (player, game, score) VALUES (?, ?, ?)", (player, game, score))
    return jsonify(ok=True), 201


init_db()  # cria a tabela também ao usar `flask run`

if __name__ == "__main__":
    # Debug só se FLASK_DEBUG=1 (nunca em produção)
    app.run(debug=os.environ.get("FLASK_DEBUG") == "1")
