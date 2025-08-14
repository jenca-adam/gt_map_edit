#!/usr/bin/env python3
from flask import Flask, render_template, request, abort
import gt_api
from gt_api.errors import GeotasticAPIError
import base64
import json
import requests
import validators

# from flask_cors import cross_origin
app = Flask(__name__, static_folder="static")


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/login/")
def login():
    return render_template("login.html")


@app.route("/proxy/gt/<path:url>", methods=["GET", "POST"])
def gt_proxy(url):
    server = request.args.get("server", "api")
    token = request.args.get("token")
    enc = request.args.get("enc") == "true"
    if "params" in request.args:
        params = json.loads(base64.b64decode(request.args["params"]))
    else:
        params = {}
    url = f"https://{server}.geotastic.net/{url}"
    kwargs = {}
    if request.method == "POST":
        data = request.json
        if enc:
            data = {"enc": gt_api.generic.encode_encdata(data)}
        kwargs["json"] = data
    try:
        response = gt_api.generic.process_response(
            gt_api.generic.geotastic_api_request(
                url, request.method, token, params=params, **kwargs
            )
        )
    except GeotasticAPIError as e:
        return {"status": "error", "message": str(e), "response": None}
    except requests.exceptions.ConnectionError:
        return {"status": "error", "message": "failed to connect", "response": ""}, 503
    return {"status": "ok", "message": "", "response": response}


@app.route("/proxy/any", methods=["GET", "POST"])
def any_proxy():
    if "url" not in request.args:
        return "Error", 400
    try:
        url = base64.b64decode(request.args["url"]).decode()
    except:
        return "Error", 400
    if not validators.url(url):
        return "Error", 400
    resp = requests.request(request.method, url, data=request.form)
    return resp.content, resp.status_code


@app.route("/view/<string:w>/<path:id>")
def view_map(w, id):
    return render_template("view_map.html")


if __name__ == "__main__":
    app.run(port=5000, debug=True)
