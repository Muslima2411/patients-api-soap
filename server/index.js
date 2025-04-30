import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { parseStringPromise } from 'xml2js';
import { Builder } from 'xml2js';
import { patients } from './db.js';
import { v4 as uuidv4 } from 'uuid';

const PORT = 4000;

const app = express();
app.use(bodyParser.text({ type: 'text/xml' }));
app.use(cors());


const soapResponseBuilder = (data, operation)=> {
    const builder = new Builder({headless: true});

    const soapResponse = {
        "soap:Envelope":{
            $: {"xmlns": "http://schemas.xmlsoap.org/soap/envelope/"},
            "soap:Body":{}
        }
    };

    if(operation === "findMany"){
        soapResponse["soap:Envelope"]["soap:Body"] = {
            patients: data
        };
    }

    else if(operation === "patientCreated"){
        soapResponse["soap:Envelope"]["soap:Body"] = {
            patientCreated: {
                patient: data
            }
        };
    }

    return builder.buildObject(soapResponse);
};



app.post('/soap', async (req, res)=> { 
    const parsedData = await parseStringPromise(req.body, { explicitArray: true, attrkey: 'attr' });

    const reqBody = parsedData["soap:Envelope"]["soap:Body"];

    if(reqBody[0].getAllPatients){
        res.set('Content-Type', 'text/xml');
        res.send(soapResponseBuilder(patients, "findMany"));
    }

    else if(reqBody[0].createPatient){

        const patient = reqBody[0].createPatient[0]["attr"];
        const newPatient = {id: uuidv4(), ...patient};
        patients.push(newPatient);
        
        res.set('Content-Type', 'text/xml');
        res.send(soapResponseBuilder(newPatient, "patientCreated"));
    }




});


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}
);