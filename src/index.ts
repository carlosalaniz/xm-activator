import 'dotenv/config'
import express from 'express'
import axios from 'axios';
import querystring from 'querystring'
import { json } from 'body-parser';
import captchaQuestions from '../captcha.json'
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
type CaptchaQuestion = {
    question: string,
    regex: string,
    options: string[]
}

type AuthTokens = {
    claims_token: {
        value: string;
        exp: number;
    };
    refresh_token: string;
};

type ServiceMeta = {
    version: string;
    url: string;
    type: string;
}

type AppConfig = {
    appId: string;
    baseId: string;
    name: string;
    selflink: string;
    integsvc: {
        [key: string]: string;
    };
    reportingsvc: {
        custom: string;
        session: string;
    };
    services_meta: {
        [key: string]: ServiceMeta;
    };
}

type Error = {
    resultCode: string;
};

type SuccessResponse = {
    opstatus: 0;
    seqValue: string,
    errors: Error[];
    httpStatusCode: 200;
};

type ErrorResponse = {
    faultcode: string;
    faultdetail: string;
    opstatus: number;
    errmsg: string;
    httpStatusCode: number;
};

type ApiResponse = SuccessResponse | ErrorResponse;

const app = express();
app.use(express.json())

const port = process.env.app_port || 8080;
const maxSessions = process.env.max_sessions || 1000; // 1000 sessions max
const sessionTTL = process.env.session_ttl || 120 * 1000; // 120 seconds
const xKonyAppSecret = process.env.x_kony_app_secret || 'e3048b73f2f7a6c069f7d8abf5864115'
const xKonyAppKey = process.env.x_kony_app_key || '85ee60a3c8f011baaeba01ff3a5ae2c9'
const XKonyDeviceID = process.env.x_kony_device_id || "8FF62332-71B1-4699-B11B-7D32F9C12999"
const defaultDealerLatLong: [string, string] = ["32.374343677", "-86.210274696"]
const XKonyAPIVersion = "1.0"
const mfid = "3de259b8-e39b-4f60-b2ba-ae3d4a2655bf"
const mfbaseid = "5fa7a77c-aa7e-423f-b9bd-4fe67e91bb71"
const rsid = "1668318090440-ac27-f025-7685"
const XKonyReportingParams = {
    "os": "16.1.1",
    "dm": "unknown",
    "did": XKonyDeviceID,
    "ua": "iPhone",
    "aid": "DealerApp",
    "aname": "SXM Dealer",
    "chnl": "mobile",
    "plat": "ios",
    "aver": "2.4.0",
    "atype": "native",
    "stype": "b2c",
    "kuid": "",
    "mfaid": mfid,
    "mfbaseid": mfbaseid,
    "mfaname": "DealerApp",
    "sdkversion": "8.4.134",
    "sdktype": "js",
    "fid": "frmHome",
    "sessiontype": "I",
    "rsid": rsid
}
const jar = new CookieJar();
const axiosInstance = wrapper(
    axios.create({
        jar
    })
)

// Interceptor to log responses
axiosInstance.interceptors.response.use(response => {
    console.log('Response:', JSON.stringify(response.data));
    return response;
}, error => {
    console.log('Error:', error);
    return Promise.reject(error);
});



const captchaRegistry = {} as {
    [sessionId: string]: CaptchaQuestion
}

function clearSessions() {

}

function getNewCaptchaQuestion() {

}

const XMClient = {
    appConfig: async (): Promise<AppConfig> => {
        return await axiosInstance.get("https://mcare.siriusxm.ca/authService/100000002/appconfig", {
            headers: {
                "X-Kony-App-Secret": xKonyAppSecret,
                "X-Kony-App-Key": xKonyAppKey,
            }
        }).then(r => r.data)
    },
    login: async (): Promise<AuthTokens> => {
        const r = await axiosInstance.post("https://mcare.siriusxm.ca/authService/100000002/login",
            querystring.stringify({}),
            {
                headers: {
                    "X-Kony-App-Secret": xKonyAppSecret,
                    "X-Kony-App-Key": xKonyAppKey,
                    "content-type": "application/x-www-form-urlencoded"
                }
            })
        return r.data;
    },
    versionControl: async (token: string) => {
        return await axiosInstance.post("https://mcare.siriusxm.ca/services/DealerAppService7/VersionControl",
            querystring.stringify({
                "deviceCategory": "iPhone",
                "appver": "2.4.0",
                "deviceLocale": "en_US",
                "deviceModel": "unknown",
                "deviceVersion": "16.1.1",
                "deviceType": "",
            }),
            {
                headers: {
                    "X-Kony-ReportingParams": JSON.stringify({
                        ...XKonyReportingParams,
                        "svcid": "VersionControl"
                    }),
                    "X-Kony-DeviceId": XKonyDeviceID,
                    "X-Kony-API-Version": "1.0",
                    "Content-Type": "application/x-www-form-urlencoded",
                    "X-Kony-Authorization": token
                }
            }).then(r => r.data)

    },
    properties: async (token: string) => {
        return await axiosInstance.post("https://mcare.siriusxm.ca/services/DealerAppService7/getProperties",
            querystring.stringify({}),
            {
                headers: {
                    "X-Kony-ReportingParams": JSON.stringify({
                        ...XKonyReportingParams,
                        "svcid": "getProperties"
                    }),
                    "X-Kony-DeviceId": XKonyDeviceID,
                    "X-Kony-API-Version": "1.0",
                    "Content-Type": "application/x-www-form-urlencoded",
                    "X-Kony-Authorization": token
                }
            }).then(r => r.data)
    },
    updateDeviceSatRefreshWithPriority: async (token: string, XMDeviceId: string, latLong: [string, string] = defaultDealerLatLong): Promise<ApiResponse> => {
        const url = "https://mcare.siriusxm.ca/services/USUpdateDeviceSATRefresh/updateDeviceSATRefreshWithPriority";

        const data = querystring.stringify({
            "deviceId": XMDeviceId,
            "appVersion": "2.4.0",
            "lng": "-86.210274696",
            "provisionPackageName": "",
            "vin": "",
            "deviceID": "8FF62332-71B1-4699-B11B-7D32F9C12999",
            "flow_name": "Enter Radio ID",
            "provisionPriority": "2",
            "provisionType": "activate",
            "phone": "",
            "device_Type": "iPhone unknown",
            "note": "1",
            "AuthName": "",
            "os_Version": "iPhone 16.1.1",
            "AuthPwd": "",
            "lat": "32.374343677",
            "provisionDate": "",
            "dmCode": "",
            "vehicle_active_flag": "",
            "base64": "X06FDae2079Ge5H9PYW5sg=="
        });
        return await axiosInstance.post(url, data, {
            headers: {
                'Accept': '*/*',
                'X-Kony-ReportingParams': '{"os":"16.1.1","dm":"unknown","did":"8FF62332-71B1-4699-B11B-7D32F9C12999","ua":"iPhone","aid":"DealerApp","aname":"SXM Dealer","chnl":"mobile","plat":"ios","aver":"2.4.0","atype":"native","stype":"b2c","kuid":"","mfaid":"3de259b8-e39b-4f60-b2ba-ae3d4a2655bf","mfbaseid":"5fa7a77c-aa7e-423f-b9bd-4fe67e91bb71","mfaname":"DealerApp","sdkversion":"8.4.134","sdktype":"js","fid":"frmRefresh","sessiontype":"I","rsid":"1668318090440-ac27-f025-7685","svcid":"updateDeviceSATRefreshWithPriority"}',
                'X-Kony-API-Version': '1.0',
                'X-Kony-DeviceId': '8FF62332-71B1-4699-B11B-7D32F9C12999',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate',
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'SXM Dealer/3 CFNetwork/1399 Darwin/22.1.0',
                'X-Kony-Authorization': token
            }
        }).then(r => r.data)
    },
    getCrmAccountPlanInfo: async (token: string, XMDeviceId: string, seqValue: string | number) => {
        return await axiosInstance.post("https://mcare.siriusxm.ca/services/DemoConsumptionRules/GetCRMAccountPlanInformation",
            querystring.stringify({
                "seqVal": seqValue,
                "deviceId": XMDeviceId,
            }),
            {
                headers: {
                    "X-Kony-ReportingParams": JSON.stringify({
                        ...XKonyReportingParams,
                        "svcid": "GetCRMAccountPlanInformation"
                    }),
                    "X-Kony-DeviceId": XKonyDeviceID,
                    "X-Kony-API-Version": "1.0",
                    "Content-Type": "application/x-www-form-urlencoded",
                    "X-Kony-Authorization": token
                }
            }).then(r => r.data)
    },
    blockListDevice: async (token: string) => {
        const url = "https://mcare.siriusxm.ca/services/USBlockListDevice/BlockListDevice";
        await axiosInstance.post(url,
            "deviceId=8FF62332-71B1-4699-B11B-7D32F9C12999",  // Data payload as x-www-form-urlencoded
            {
                headers: {
                    'Accept': '*/*',
                    "X-Kony-ReportingParams": JSON.stringify({
                        ...XKonyReportingParams,
                        "svcid": "BlockListDevice"
                    }),
                    "X-Kony-DeviceId": XKonyDeviceID,
                    "X-Kony-API-Version": "1.0",
                    "Content-Type": "application/x-www-form-urlencoded",
                    "X-Kony-Authorization": token
                }
            })
    },
    createAccount: async (token: string, XMDeviceId: string, seqValue: number) => {
        const url = "https://mcare.siriusxm.ca/services/DealerAppService3/CreateAccount";

        const data = querystring.stringify({
            "seqVal": seqValue, // Replace this with your actual seq_value
            "deviceId": XMDeviceId, // Replace this with your actual device_id
            "oracleCXFailed": "1",
            "appVersion": "2.4.0"
        });

        return await axiosInstance.post(url, data, {
            headers: {
                'Connection': 'close',
                'Accept': '*/*',
                "X-Kony-ReportingParams": JSON.stringify({
                    ...XKonyReportingParams,
                    "svcid": "CreateAccount"
                }),
                "X-Kony-DeviceId": XKonyDeviceID,
                "X-Kony-API-Version": "1.0",
                "Content-Type": "application/x-www-form-urlencoded",
                "X-Kony-Authorization": token
            }
        }).then(r => r.data)
    },
    updateDeviceSatRefreshWithPriorityCC: async (token: string, XMDeviceId: string): Promise<ApiResponse> => {
        return await axiosInstance.post("https://mcare.siriusxm.ca/services/USUpdateDeviceRefreshForCC/updateDeviceSATRefreshWithPriority",
            querystring.stringify({
                "deviceId": XMDeviceId,
                "provisionPriority": "2",
                "appVersion": "2.4.0",
                "note": "1",
                "provisionPackageName": "",
                "dmCode": "",
                "device_Type": "iPhone unknown",
                "deviceID": XKonyDeviceID,
                "os_Version": "iPhone 16.1.1",
                "provisionType": "activate",
                "provisionDate": "",
            }),
            {
                headers: {
                    "X-Kony-ReportingParams": JSON.stringify({
                        ...XKonyReportingParams,
                        "svcid": "updateDeviceSATRefreshWithPriority"
                    }),
                    "X-Kony-DeviceId": XKonyDeviceID,
                    "X-Kony-API-Version": "1.0",
                    "Content-Type": "application/x-www-form-urlencoded",
                    "X-Kony-Authorization": token
                }
            }).then(r => r.data)
    },
    googleDbUpdate: async () => {
        await axiosInstance
            .post("https://mcare.siriusxm.ca/services/DBSuccessUpdate/DBUpdateForGoogle")
            .then(r => r.data)
    }
}


app.post("/verify-captcha", () => {

})



var token: AuthTokens = null;
async function activate(XMDeviceId, lat, long) {
    console.log(XMDeviceId, lat, long);
    // await XMClient.appConfig();
    if (!token || token.claims_token.exp - 120000 >= Date.now()) {
        token = await XMClient.login();
    }
    // await XMClient.versionControl(token.claims_token.value)
    // await XMClient.properties(token.claims_token.value)
    const r1 = await XMClient.updateDeviceSatRefreshWithPriority(
        token.claims_token.value,
        XMDeviceId,
        (lat && long) ? [lat, long] : defaultDealerLatLong
    )

    // Error
    if (r1.opstatus !== 0) {
        return r1;
    }
    const seqValue = (r1 as SuccessResponse).seqValue;
    await XMClient.blockListDevice(token.claims_token.value)
    const account_create_response = await XMClient.createAccount(token.claims_token.value, XMDeviceId, +seqValue)
    await XMClient.updateDeviceSatRefreshWithPriorityCC(token.claims_token.value, XMDeviceId);
    return account_create_response;
}
app.post("/activate", async (req, res) => {
    const { XMDeviceId, lat, long } = req.body
    console.log(XMDeviceId, lat, long, req.body);
    res.json(await activate(XMDeviceId, lat, long))
})


app.listen(port, () => { console.log(`listeing to port ${port}`) })
