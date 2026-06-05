const axios = require('axios');
axios.post('http://localhost:8000/api/tests/1/questions', {
  title: "A", description: "B"
}).catch(e => console.log(e.response.data));
