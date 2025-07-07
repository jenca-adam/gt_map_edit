#!/usr/bin/env python3
from flask import Flask, render_template, request
import gt_api
from gt_api.errors import GeotasticAPIError
import base64
import json
#from flask_cors import cross_origin
app = Flask(__name__, static_folder="static")

@app.route("/")
def index():
    return render_template("index.html")
@app.route("/login/")
def login():
    return render_template("login.html")
@app.route("/proxy/<path:url>", methods=["GET", "POST"])
def gt_proxy(url):
    server = request.args.get("server", "api")
    token = request.args.get("token")
    enc = request.args.get("enc")=="true"
    if "params" in request.args:
        params = json.loads(base64.b64decode(request.args["params"]))
    else:
        params = {}
    url = f"https://{server}.geotastic.net/{url}"
    kwargs = {}
    if request.method == "POST":
        data = request.json
        if enc:
            data={"enc":gt_api.generic.encode_encdata(data)}
        kwargs["json"]=data
    try:
        response = gt_api.generic.process_response(gt_api.generic.geotastic_api_request(url, request.method, token, params=params, **kwargs))
    except GeotasticAPIError as e:
        return {"status":"error", "message":str(e), "response":None}
    return {"status":"ok", "message":"", "response":response}
@app.route("/view-map/<string:id>") 
def view_map(id):
    return render_template("view_map.html")
if __name__=="__main__":
    app.run(port=5000, debug=True)
