const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Atlas કનેક્શન (Render પર MONGO_URI સેટ કરવો પડશે)
const mongoURI = process.env.MONGO_URI || "mongodb+srv://devalrabari7998_db_user:I1457fmroeW6DZfR@cluster0.4rsrknt.mongodb.net/?appName=Cluster0";

mongoose.connect(mongoURI)
    .then(() => console.log("✓ MongoDB Atlas સાથે કનેક્શન થઈ ગયું છે!"))
    .catch((err) => console.error("MongoDB કનેક્શનમાં ભૂલ આવી:", err));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ---- Mongoose Schemas & Models ----

// ૧. ગ્રાહક સ્કીમા
const customerSchema = new mongoose.Schema({
    id: { type: Number, unique: true, required: true },
    name: { type: String, required: true }
});
const Customer = mongoose.model('Customer', customerSchema);

// ૨. દૂધ એન્ટ્રી સ્કીમા
const recordSchema = new mongoose.Schema({
    rawDate: String,
    date: String,
    id: Number,
    name: String,
    shift: String,
    milkType: String,
    liters: Number,
    fat: Number,
    rate: Number,
    totalAmt: Number
});
const MilkRecord = mongoose.model('MilkRecord', recordSchema);


// ---- API Endpoints ----

// API: બધો ડેટા એકસાથે મેળવવા માટે
app.get('/api/data', async (req, res) => {
    try {
        const customersList = await Customer.find({});
        const recordsList = await MilkRecord.find({});
        
        // ફ્રન્ટ-એન્ડના ફોર્મેટ મુજબ ગ્રાહકોને ઓબ્જેક્ટમાં બદલવું {}
        const customersObj = {};
        customersList.forEach(c => {
            customersObj[c.id] = c.name;
        });

        res.json({ customers: customersObj, records: recordsList });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: નવો ગ્રાહક સેવ કરવા માટે
app.post('/api/customers', async (req, res) => {
    try {
        const { id, name } = req.body;
        
        // જો ગ્રાહક પહેલેથી હોય તો અપડેટ કરો, નહીંતર નવો બનાવો
        await Customer.findOneAndUpdate({ id: id }, { name: name }, { upsert: true, new: true });
        
        // અપડેટ થયેલું આખું લિસ્ટ પાછું મોકલો
        const customersList = await Customer.find({});
        const customersObj = {};
        customersList.forEach(c => { customersObj[c.id] = c.name; });
        
        res.json({ success: true, customers: customersObj });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: દૂધની નવી એન્ટ્રી સેવ કરવા માટે
app.post('/api/records', async (req, res) => {
    try {
        const newEntry = new MilkRecord(req.body);
        await newEntry.save();
        
        const recordsList = await MilkRecord.find({});
        res.json({ success: true, records: recordsList });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 🛠️ નવીનતમ ઉમેરો ૧: ચોક્કસ દૂધની એન્ટ્રી ડીલીટ કરવા માટે (DELETE API)
app.delete('/api/records/:id', async (req, res) => {
    try {
        const recordId = req.params.id;
        
        // પ્રથમ ચેક કરીએ કે આઈડી મોંગોડીબીની _id છે કે કસ્ટમ id
        let deleted;
        if (mongoose.Types.ObjectId.isValid(recordId)) {
            deleted = await MilkRecord.findByIdAndDelete(recordId);
        } else {
            deleted = await MilkRecord.findOneAndDelete({ id: Number(recordId) });
        }

        if (!deleted) {
            return res.status(404).json({ success: false, message: "રેકોર્ડ મળ્યો નથી!" });
        }

        // ડીલીટ કર્યા પછી બાકી બચેલો બધો જ નવો ડેટા પાછો મોકલો
        const recordsList = await MilkRecord.find({});
        res.json({ success: true, message: "એન્ટ્રી સફળતાપૂર્વક ડીલીટ થઈ ગઈ છે.", records: recordsList });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 🛠️ નવીનતમ ઉમેરો ૨: ચોક્કસ દૂધની એન્ટ્રી સુધારવા/એડિટ કરવા માટે (PUT API)
app.put('/api/records/:id', async (req, res) => {
    try {
        const recordId = req.params.id;
        const updatedData = req.body;

        let updated;
        if (mongoose.Types.ObjectId.isValid(recordId)) {
            updated = await MilkRecord.findByIdAndUpdate(recordId, updatedData, { new: true });
        } else {
            updated = await MilkRecord.findOneAndUpdate({ id: Number(recordId) }, updatedData, { new: true });
        }

        if (!updated) {
            return res.status(404).json({ success: false, message: "રેકોર્ડ મળ્યો નથી!" });
        }

        // અપડેટ કર્યા પછી નવો તાજો ડેટા મોકલો
        const recordsList = await MilkRecord.find({});
        res.json({ success: true, message: "એન્ટ્રી સફળતાપૂર્વક અપડેટ થઈ ગઈ છે.", records: recordsList });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: બધો દૂધનો ડેટા સાફ કરવા માટે
app.post('/api/clear', async (req, res) => {
    try {
        await MilkRecord.deleteMany({}); // માત્ર રેકોર્ડ સાફ થશે, ગ્રાહકો નહિ
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// સર્વર લિસનર
app.listen(PORT, () => {
    console.log(`સર્વર પોર્ટ ${PORT} પર ચાલુ છે.`);
});
