#!/usr/bin/env python3
from flask import Flask, render_template, request, abort, Response
import base64
import json
import requests
import urllib.parse

# from flask_cors import cross_origin
app = Flask(__name__, static_folder="static")


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/login/")
def login():
    return render_template("login.html")


@app.route("/proxy/gt/<string:server>/<path:url>", methods=["GET", "POST", "OPTIONS"])
def gt_proxy(server, url):
    target_url = f"https://{server}.geotastic.net/{url}"
    
    headers = {k: v for k, v in request.headers if k.lower() not in ['host', 'content-length']}
    headers["Origin"] = "https://geotastic.net"
    headers["Referer"] = "https://geotastic.net/"
    
    try:
        resp = requests.request(
            method=request.method,
            url=target_url,
            headers=headers,
            data=request.get_data(),
            params=request.args,
            cookies=request.cookies,
            allow_redirects=False
        )
    except requests.exceptions.RequestException as e:
        return {"status": "error", "message": str(e)}, 502

    excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']
    proxy_headers = [
        (name, value) for (name, value) in resp.raw.headers.items()
        if name.lower() not in excluded_headers
    ]
    
    response = Response(resp.content, resp.status_code, proxy_headers)
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response

@app.route("/proxy/gm/<path:url>", methods=["GET", "POST", "OPTIONS"])
def gm_proxy(url):
    target_url = f"https://maps.googleapis.com/{url}"
    headers = {k: v for k, v in request.headers if k.lower() not in ['host', 'content-length']}
    try:
        resp = requests.request(
            method=request.method,
            url=target_url,
            headers=headers,
            data=request.get_data(),
            params=request.args,
            cookies=request.cookies,
            allow_redirects=False
        )
    except requests.exceptions.RequestException as e:
        return {"status": "error", "message": str(e)}, 502

    excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']
    proxy_headers = [
        (name, value) for (name, value) in resp.raw.headers.items()
        if name.lower() not in excluded_headers
    ]
    
    response = Response(resp.content, resp.status_code, proxy_headers)
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response


@app.route("/view/<string:w>/<path:id>")
def view_map(w, id):
    return render_template("view_map.html")


if __name__ == "__main__":
    app.run(port=5000, debug=True)
