from flask import Flask, request
import mysql.connector

app = Flask(__name__)


@app.route("/")
def home():
    return "HistoryLens Backend is running!"


@app.route("/history", methods=["POST"])
def receive_history():
    data = request.json

    connection = mysql.connector.connect(
        host="localhost",
        user="root",
        password="abcdefghijkl",
        database="historylens"
    )

    cursor = connection.cursor()

    query = """
        INSERT INTO history
        (id, title, url, visit_count, last_visit_time)
        VALUES (%s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            url = VALUES(url),
            visit_count = VALUES(visit_count),
            last_visit_time = VALUES(last_visit_time)
    """

    values = (
        data["id"],
        data["title"],
        data["url"],
        data["visitCount"],
        data["lastVisitTime"]
    )

    cursor.execute(query, values)

    connection.commit()

    cursor.close()
    connection.close()

    return {"message": "History saved successfully!"}

# get history.......

@app.route("/history", methods=["GET"])
def get_history():
    connection = mysql.connector.connect(
        host="localhost",
        user="root",
        password="abcdefghijkl",
        database="historylens"
    )

    cursor = connection.cursor(dictionary=True)

    query = """
        SELECT id, title, url, visit_count, last_visit_time
        FROM history
        ORDER BY last_visit_time DESC
    """

    cursor.execute(query)

    history = cursor.fetchall()

    cursor.close()
    connection.close()

    return {
        "count": len(history),
        "history": history
    }


@app.route("/usage", methods=["POST"])
def update_usage():
    data = request.json

    domain = data["domain"]
    duration = data["duration"]
    last_used = data["last_used"]

    connection = mysql.connector.connect(
        host="localhost",
        user="root",
        password="abcdefghijkl",
        database="historylens"
    )

    cursor = connection.cursor()

    query = """
        INSERT INTO website_usage
        (domain, total_time, last_used)
        VALUES (%s, %s, %s)
        ON DUPLICATE KEY UPDATE
            total_time = total_time + %s,
            last_used = %s
    """

    values = (
        domain,
        duration,
        last_used,
        duration,
        last_used
    )

    cursor.execute(query, values)
    connection.commit()

    cursor.close()
    connection.close()

    return {
        "message": "Website usage updated successfully",
        "domain": domain,
        "duration": duration
    }


@app.route("/usage", methods=["GET"])
def get_usage():

    connection = mysql.connector.connect(
        host="localhost",
        user="root",
        password="abcdefghijkl",
        database="historylens"
    )

    cursor = connection.cursor(dictionary=True)

    query = """
        SELECT id, domain, total_time, last_used
        FROM website_usage
        ORDER BY total_time DESC
    """

    cursor.execute(query)

    usage = cursor.fetchall()

    cursor.close()
    connection.close()

    return {
        "count": len(usage),
        "usage": usage
    }

def test_database():
    connection = mysql.connector.connect(
        host="localhost",
        user="root",
        password="abcdefghijkl",
        database="historylens"
    )

    print("MySQL connected successfully!")

    connection.close()





if __name__ == "__main__":
    test_database()
    app.run(debug=True)


