import os

import requests, sys, logging
import json
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

app.config['DEBUG'] = False
app.logger.addHandler(logging.StreamHandler(sys.stdout))
app.logger.setLevel(logging.DEBUG)
app.config['SESSION_COOKIE_SAMESITE'] = None
app.config['JIRA_URL'] = "https://jira.cfdata.org"
DEBUG = app.config['DEBUG']

products = ["Access", "Analytics", "API Gateway", "Area 1", "Argo", "Bot Management", "Browser Isolation",
            "CASB", "CDN", "China Network", "Cloudflare Stream", "Data Localization", "DDoS Protection",
            "DNS", "Email Routing", "Gateway", "Identity", "Images", "Load Balancing", "Logs", "Magic Firewall",
            "Magic Transit",
            "Magic WAN", "Network Interconnect (CNI)", "Page Shield", "Pages", "Premium Success", "R2", "Rate Limiting",
            "Spectrum",
            "SSL / TLS Encryption", "SSL / TLS for SaaS Providers", "Tunnel", "WAF", "Waiting Room", "WARP",
            "Website Optimization Services",
            "Workers", "Workers KV", "Zaraz", "Zero Trust"]



def convert_custom_fields(fields):
    custom_fields = {'sales_force_id':'customfield_20323',
                'op_id':'customfield_20324',
                 'start_date':'customfield_11300',
               'region': 'customfield_18408',
               'description':'description',
               'customer':'summary'}
    new_fields = {}
    for field in fields.keys():
        if custom_fields[field] not in ('customfield_18408'):
            new_fields[custom_fields[field]] = str(fields[field])
        else:
            new_fields[custom_fields[field]] = {'value:': fields[field]}
    return new_fields


def make_request(cf_auth, token, method, url, payload=None, query=False):
    COOKIES = {'SameSite': 'None', 'CF_Authorization': cf_auth}
    HEADERS = {'Authorization': 'Bearer ' + token}

    if not DEBUG or query:
        try:
            response = requests.request(method, url, cookies=COOKIES, headers=HEADERS, json=payload)
            if "Cloudflare Access</title>" not in response.text and not "errorMessages" in response.text:
                print('The request was successful.')
                print(response.text)
                if response.status_code == 200:
                    return response.json()
            elif "errorMessages" in response.text and "anonymous users" in response.text:
                print('The request failed')
                return {"error": "The request failed.Please try entering your Jira API Token"}
            else:
                print('The request failed to pass Access.')
                return {"error":"Could not pass Access. Please check CF_Auth token"}
        except requests.exceptions.RequestException as e:
            return {"error":[e]}
    else:
        print("Printing Payload instead of making REST request")
        data = {
            'method': method,
            'url': url,
            'payload': payload,
            'query': query
        }
        return jsonify(data)

def get_current_user(cf_auth, token):
    url = 'https://jira.cfdata.org/rest/api/2/myself'
    return make_request(cf_auth, token, 'GET', url,True)

def create_issue(cf_auth, token,payload):
    url = app.config['JIRA_URL'] + '/rest/api/2/issue/'
    return make_request(cf_auth, token, 'POST', url, payload, False)

def link_issues(cf_auth, token,epic_key, payload):
    url = app.config['JIRA_URL'] + f'/rest/agile/1.0/epic/{epic_key}/issue'
    return make_request(cf_auth, token,'POST', url, payload, False)

def get_issue(cf_auth, token,issue_key):
    url = app.config['JIRA_URL'] + f'/rest/api/2/issue/{issue_key}'
    return make_request(cf_auth, token,'GET', url, query=True)

def get_epic(cf_auth, token,epic_key):
    url = app.config['JIRA_URL'] + f'/rest/agile/1.0/epic/{epic_key}/issue'
    return make_request(cf_auth, token,'GET', url, query=True)

def update_epic(cf_auth, token,epic_key,fields):
    # Define the Jira API endpoint and headers
    url = app.config['JIRA_URL'] + f'/rest/api/2/issue/{epic_key}'
    payload = {
        "update": {}
    }
    for field in fields:
        payload["update"][field] = [{"set":fields[field]}]

    return make_request(cf_auth, token,'PUT', url, payload, False)

def jira_query(cf_auth, token,jql):
    url = app.config['JIRA_URL'] + '/rest/api/2/search'
    payload = {
        "jql": jql,
        "startAt": 0,
        "maxResults": 50
    }
    return make_request(cf_auth, token,'POST', url, payload, query=True)

def create_child_issues(cf_auth, token,epic_id, customer, sales_force_id, op_id, start_date, region, selected_products):
    issue_keys = []
    for product in selected_products:
        # Make Jira API call for each product
        issue = create_issue(cf_auth, token, {
            'fields': {
                'project': {'key': "ONBOARD"},
                'summary': customer + " - " + str(product),
                'issuetype': {'name': "Project"},
                'customfield_20323': str(sales_force_id),
                'customfield_20324': str(op_id),
                "customfield_20325": {"value": str(product)},
                "customfield_11300": start_date,
                'customfield_18408': {"value": region}
            }
        })
        if issue["key"]:
            issue_keys.append(issue["key"])
    print("Children created:" + str(issue_keys))
    response = link_issues(cf_auth, token, epic_id, payload={"issues": issue_keys})
    if response.status_code == 204:
        return jsonify({'status':'success','epic_id':epic_id,'projects':issue_keys})
    else:
        return jsonify({'status': 'failed', 'epic_id': epic_id, 'projects': issue_keys, 'message':'Not Linked'})

@app.route('/get-onboards', methods=["POST"])
def get_epics_for_project(project_key="Onboard"):
    cf_auth = request.form.get('cf_auth', default=None)
    token = request.form.get('token', default=None)
    #print(cf_auth, token)
    if(token is not None):
        jql = f"project={project_key} and issuetype=Epic"
        response = jira_query(cf_auth,token,jql)
        if "error" not in response:
                user = get_current_user(cf_auth, token)
                print("User " + str(user))
                response_data = response
                issues = response_data.get("issues")
                epics = [{"key": issue["key"], "summary": issue["fields"]["summary"]} for issue in issues]
                print({"epics":epics,"user":user})
                return jsonify({"epics":epics,"user":user})
        else:
            return {"error": response["error"]}
    print(f"Error retrieving Epics for project {project_key}")
    return {"error": "Update your CF_Authorization token in app.py"}

@app.route('/lookup_jira', methods=['POST'])
def lookup(cf_auth=None,token=None,jira_id=None):
    selected_value = request.form.get('selected_value')
    lookup = jira_id or selected_value

    cf_auth = request.form.get('cf_auth', default=cf_auth)
    token = request.form.get('token', default=token)

    epic = get_issue(cf_auth,token,lookup)
    linked = get_epic(cf_auth,token,lookup)

    products = []
    start_date = None
    if linked['issues']:
        for issue in linked['issues']:
            products.append(issue.get('fields', {}).get('customfield_20325', {}).get('value'))
            start_date = issue.get('fields', {}).get('customfield_11300', '')

    results = {
        'epic_id': lookup,
        'customer': epic['fields']['summary'],
        'description': epic['fields']['description'],
        'salesforce': epic['fields']['customfield_20323'],
        'opportunity': epic['fields']['customfield_20324'],
        'region': epic['fields']['customfield_18408'].get('value', ''),
        'products': products,
        'start_date': start_date,
    }
    #print(results)
    return jsonify(results)

@app.route('/', methods=['GET','POST'])
def form_processing():
    action = request.form.get('action')
    if action == 'create':
        print("HIT CREATE")
        # Get form data
        cf_auth = request.form['cf_auth']
        token = request.form['token']
        customer = request.form['customer']
        sales_force_id = request.form['salesforce']
        op_id = request.form['opportunity']
        description = request.form['description']
        start_date = request.form['start_date']
        region = request.form['region']

        # Make Jira API call to create EPIC issue
        #print(cf_auth,token, customer, sales_force_id, op_id, description, start_date, region)

        epic = create_issue(cf_auth, token, {
            'fields': {
                'project': {'key': "ONBOARD"},
                'summary': customer,
                'description': description,
                'issuetype': {'name': "Epic"},
                'customfield_20323': str(sales_force_id),
                'customfield_20324': str(op_id),
                'customfield_18408': {'value': region},
                'customfield_10701': customer
            }
        })

        if "errors" in epic:
            return jsonify(epic)
        else:
            epic_id = None or epic["key"]
            print(epic_id)

            if not epic_id:
                return jsonify(epic)
            else:
                selected_products = [key for key in request.form.keys() if 'on' in request.form.getlist(key)]
               # print(selected_products)
                response = create_child_issues(cf_auth,token,epic_id,customer,sales_force_id, op_id, start_date, region, selected_products)
                #print(response)
                print("END CREATE")
                return response
        return jsonify(epic)
    elif action == 'update':
        print("HIT UPDATE")

        epic_id, cf_auth, token, customer, sales_force_id, op_id, description, start_date, region = (
            request.form.get(field, default=None) for field in
            ('epic_id','cf_auth', 'token', 'customer', 'salesforce', 'opportunity', 'description', 'start_date', 'region')
        )

        response = lookup(cf_auth,token,epic_id)
        epic = json.loads(response.data)

        updated_fields = {}
        if customer is not None and customer != '':
            updated_fields["customer"] = customer
        if sales_force_id is not None and sales_force_id != '':
            updated_fields["sales_force_id"] = sales_force_id
        if op_id is not None and op_id != '':
            updated_fields["op_id"] = op_id
        if description is not None and description != '':
            updated_fields["description"] = description
        if start_date is not None and start_date != '':
            updated_fields["start_date"] = start_date
        if region is not None and region != '':
            updated_fields["region"] = region

        selected_products = [key for key in request.form.keys() if 'on' in request.form.getlist(key)]
        #print("New Products " + str(selected_products))

        #print("Updated Fields " + str(updated_fields))

        if len(updated_fields) > 0:
            response = update_epic(cf_auth,token,epic_id, convert_custom_fields(updated_fields))

        if len(selected_products) > 0:
            issue_keys = []
            response = create_child_issues(cf_auth,token,epic_id, epic["customer"], epic["salesforce"], epic["opportunity"], epic["start_date"], epic["region"], selected_products)
        print("END UPDATE")
        return response
    else:
        return render_template('index.html', debug=DEBUG)


if __name__ == '__main__':
    app.run()
