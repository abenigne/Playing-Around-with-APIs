"""
Hourly Weather Planner : Flask Backend.
Data Source: Open-Meteo (https://open-meteo.com/en/docs), CC BY 4
"""

import os

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request

load_dotenv()

app = Flask(__name__)

# which server answered: Local-Dev, Web-01 or Web-02
NODE_IDENTITY = os.getenv("SERVER_NAME", "Local-Dev")

FORECAST_ENDPOINT = "https://api.open-meteo.com/v1/forecast"

DEFAULT_LAT = "-1.9441"
DEFAULT_LON = "30.0619"
DEFAULT_CITY = "Kigali"

HOURS_TO_RETURN = 24
UPSTREAM_TIMEOUT_SECONDS =10

@app.route("/")
def render_dashboard():
    return render_template("index.html", node_identity=NODE_IDENTITY)


@app.route("/api/forecast")
def fetch_forecast_data():
    lat_input = request.args.get("lat_input", DEFAULT_LAT)
    lon_input = request.args.get("lon_input", DEFAULT_LON)
    city_label = request.args.get("city_label", DEFAULT_CITY).strip()
    city_label = city_label[:60]

    # coordinate validation
    try:
        latitude = float(lat_input)
        longitude = float(lon_input)
    except ValueError:
        return jsonify({"error_message": "Coordinates must be valid numbers within Earth bounds."}), 400

    if not (-90.0 <= latitude <= 90.0 and -180.0 <=longitude <=180.0):
        return jsonify({"error_message": "Coordinates must be valid numbers within Earth bounds."}),400

    # call open-meteo
    
    query_params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": "temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation",
        "timezone": "auto", 
    }

    try:
        upstream_response = requests.get(
            FORECAST_ENDPOINT, params=query_params, timeout=UPSTREAM_TIMEOUT_SECONDS
        )
        
        upstream_response.raise_for_status()
        payload = upstream_response.json()
    except requests.exceptions.Timeout:
        return jsonify({"error_message": "Weather service timed out. Try again shortly."}), 504
    except requests.exceptions.HTTPError:
        return jsonify({"error_message": "Upstream weather API returned an HTTPS error."}), 502
    except requests.exceptions.RequestException:
        return jsonify({"error_message": "Network error while contacting weather service."}), 502

    # checking for the response shape
    hourly_block = payload.get("hourly") if isinstance(payload, dict) else None
    if not isinstance(hourly_block, dict) or "time" not in hourly_block:
       return jsonify({"error_message": "Weather service returned an unexpected response."}), 502

    timestamps = hourly_block.get("time", [])
    temperatures = hourly_block.get("temperature_2m", [])
    humidities = hourly_block.get("relative_humidity_2m", [])
    wind_speeds = hourly_block.get("wind_speed_10m", [])
    rainfall = hourly_block.get("precipitation", [])

    usable_hours = min(
        HOURS_TO_RETURN,
        len(timestamps),
        len(temperatures),
        len(humidities),
        len(wind_speeds),
        len(rainfall),
    )

    if usable_hours == 0:
       return jsonify({"error_message": "Weather service returned no hourly data."}), 502
    
    # Turning parallel lists into one record per hour
    hourly_records = []
    for index in range(usable_hours):
        hourly_records.append(
            {
                "timestamp": timestamps[index],
                "temp_celsius": temperatures[index],
                "humidity_pct": humidities[index],
                "wind_kmh": wind_speeds[index],
                "rain_mm": rainfall[index],
            }
        )
    
    return jsonify(
        {
            "node_identity": NODE_IDENTITY,
            "city_label": city_label,
            "hourly_records": hourly_records,
        }
    ), 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)