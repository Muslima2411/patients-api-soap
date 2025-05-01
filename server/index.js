import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { parseStringPromise } from 'xml2js';
import { Builder } from 'xml2js';
// import { patients } from './db.js';
import { v4 as uuidv4 } from 'uuid';

const PORT = 4000;

const app = express();
app.use(bodyParser.text({ type: 'text/xml' }));
app.use(cors());

const nonces = new Set();

const users = {
    ["Alice"]: "admin123"
};

let patients = [
    {
      id: 1,
      name: "Alice Johnson",
      age: 28,
      history: "No known allergies.",
    },
    { id: 2, name: "Bob Smith", age: 34, history: "Diabetic." },
    { id: 3, name: "Charlie Lee", age: 45, history: "Hypertension." },
    { id: 4, name: "Diana Prince", age: 30, history: "Asthma." },
    { id: 5, name: "Ethan Hunt", age: 38, history: "No prior surgeries." },
    { id: 6, name: "Fiona Gallagher", age: 25, history: "Anemia." },
    { id: 7, name: "George Clooney", age: 50, history: "High cholesterol." },
    { id: 8, name: "Hannah Montana", age: 22, history: "Seasonal allergies." },
    { id: 9, name: "Ian Somerhalder", age: 40, history: "Migraines." },
    { id: 10, name: "Julia Roberts", age: 35, history: "Thyroid issues." },
  ];


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

    else if(operation === "patientDeleted"){
        soapResponse["soap:Envelope"]["soap:Body"] = {
            patientDeleted: {
                message: data
            }
        };
    }

    return builder.buildObject(soapResponse);
};

const soapFaultBuilder = (errorMessage) => {
    const builder = new Builder({headless: true});

    const soapFault = {
        "soap:Envelope":{
            $: {"xmlns": "http://schemas.xmlsoap.org/soap/envelope/"},
            "soap:Body":{
                "soap:Fault": {
                    faultcode: "soap:Server",
                    faultstring: errorMessage
                }
            }
        }
    };

    return builder.buildObject(soapFault);
}


const checkTime = (created) => {
    const createdDate = new Date(created);
    const currentDate = new Date();
    const diff = Math.abs(currentDate - createdDate);
    const diffInMinutes = 5 * 60 * 1000; 

    
    return diff <= diffInMinutes;
}

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
   
    else if (reqBody[0].deletePatient) {
        const id = parseInt(reqBody[0].deletePatient[0], 10);
        if (isNaN(id)) {
            return res.status(400).send('Invalid patient ID');
        }

        const initialLength = patients.length;
        patients = patients.filter((p) => p.id !== id);

        if (patients.length === initialLength) {
            return res.status(404).send('Patient not found');
        }

        res.set('Content-Type', 'text/xml');
        res.send(soapResponseBuilder("User has been deleted", "patientDeleted"));
    }

    else if(reqBody[0].getPatientDetails){
        console.log("getPatientDetails");

        const header = parsedData["soap:Envelope"]["soap:Header"][0]["wsse:Security"][0]["wsse:UsernameToken"][0];
        console.log(header);

        const nonce = header["wsse:Nonce"][0];
        const created = header["wsu:Created"][0];

        if(nonces.has(nonce)){
            return res.status(401).send({message: "Replaye attack detected (nonce already used)"});
        }

        nonces.add(header["wsse:Nonce"][0]);

        if(!checkTime(created)){
            return res.status(401).send({message: "Replaye attack detected (timestamp expired)"});
        }

        setTimeout(() => {
            nonces.delete(nonce);
        }, 5 * 60 * 1000);


        
    }


});


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}
);