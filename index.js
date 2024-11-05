const fs = require('fs')
const fetch = require('node-fetch')
const zlib = require('zlib')
const readline = require('readline');
const path = require('path');

const {
    Client
} = require('@elastic/elasticsearch');
const client = new Client({
    node: 'http://51.158.62.129:9200',
    auth: {
        apiKey: 'MHRXNGdKSUJ0SjBONmhhajhGY1U6a0VRZkxEenNTOVcxeDZjWVh4U1lEZw=='
    },
    ssl: {
        rejectUnauthorized: false
    }
});


async function download() {
    const url = "https://cve.circl.lu/static/circl-cve-search-expanded.json.gz"
    const response = await fetch(url)
    const buffer = await response.buffer()
    fs.writeFileSync('./cve.json.gz', buffer)
    console.log('Downloaded the file')
}

async function unzip(inputPath, outputPath) {
    const input = fs.createReadStream(inputPath);
    const output = fs.createWriteStream(outputPath);
    const unzip = zlib.createUnzip();
    input.pipe(unzip).pipe(output);

    return new Promise((resolve, reject) => {
        output.on('finish', () => {
            console.log('File successfully unzipped.');
            resolve();
        });
    })
}

async function processLineByLineJSON(filePath) {
    const rl = readline.createInterface({
        input: fs.createReadStream(filePath),
        crlfDelay: Infinity, // Handles different newline types (\n or \r\n)
    });
    let i = 0
    let data = []

    rl.on('line', async (line) => {
        try {
            i++
            // Attempt to parse each line as JSON
            const jsonData = JSON.parse(line);
            data.push(jsonData)
            if(i % 1000 === 0) {
                console.log('Processed', i, 'lines')
                fs.writeFileSync('./pack/' + i + '.json', JSON.stringify(data))
                data = []
            }
        } catch (error) {
            console.error('Failed to parse line as JSON:', error.message);
        }
    });

    rl.on('close', () => {
        console.log('Completed processing the JSON file line by line.');
    });
}

function allfiles(directory) {
    // Read the directory contents
    fs.readdir(directory, async (err, files) => {
        if (err) {
            console.error('Error reading directory:', err);
            return;
        }

        // Filter for only JSON files
        const jsonFiles = files.filter(file => path.extname(file).toLowerCase() === '.json');

        console.log('JSON files found:', jsonFiles);

        for (const element of jsonFiles) {

            const filePath = path.join(directory, element);

            console.log('Processing file:', filePath);
            // Read each JSON file
            const content = JSON.parse(fs.readFileSync("./"+filePath, 'utf8'));
            console.log('Content:', content.length);
            for (const element of content) {
                let capsec = element.capec
                delete element.capec
                let list = []
                try {
                    for (const cap of capsec) {
                        list.push(cap.id)
                        //push_capec(cap)
                    }
                } catch (error) {
                    
                }

                await push(element)
                //process.exit()
            }
        }

    });
}


async function push(element) {
    const docId = element.id;  // Assuming the document has an 'id' field
    console.log('Pushing', docId)

    const { body } = await client.update({
        index: 'cve',
        id: docId,  // Update by document ID
        body: {
            doc: element, // Update the document
            doc_as_upsert: true // Insert if the document doesn't exist
        }
    });
}

async function push_capec(element) {
    const docId = element.id;  // Assuming the document has an 'id' field
    console.log('Pushing Capsec', docId)

    const { body } = await client.update({
        index: 'cve-capec',
        id: docId,  // Update by document ID
        body: {
            doc: element, // Update the document
            doc_as_upsert: true // Insert if the document doesn't exist
        }
    });

}


async function main() {
    // Step 1: download the file
    //await download()

    // Step 2: unzip the file
    //await unzip('./cve.json.gz', './cve.json')
   
    //processLineByLineJSON('./cve.json')
    allfiles("./pack")
}
main()