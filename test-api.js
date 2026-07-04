const axios = require('axios');
axios.get('http://localhost:5001/api/popup-ad').then(res => console.log(Object.keys(res.data))).catch(console.error);
