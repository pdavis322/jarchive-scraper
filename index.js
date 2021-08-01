// TODO: incorporate images/videos in clues (ex: id=1 "board" for 1000)
const { MongoClient } = require("mongodb");
const axios = require('axios');
const cheerio = require('cheerio');

const uri = "mongodb://172.24.16.1:27017";
const client = new MongoClient(uri);
let url = "https://www.j-archive.com/showgame.php?game_id=6786"
let id = 1;


// Get clues for category given which round and category index
// This asssumes that if we have the correct number of valid clues, we have an answer for each clue
function getClues($, i, which) {
	// clue_(J or DJ)_i
	clues = $("td[id^='clue_" + which + "_" + (i + 1) + "']").toArray();

	// Need to have 5 clues or don't put the category in
	if (clues.length != 10) {
		return false;
	}

	// [] to indicate accumulator should be an array
   // Could use reduce instead of this, but couldn't figure out a good way of efficiently validating clues/answers

	let index = 0;
	let cluesIndex = 0;
	let cluesList = [];
	while (index < 10) {
		// Current element
		let e = $(clues).eq(index);
		let text = $(e).text();
		if (text === "=") {
			cluesList = false;
			break;
		}
		else if (text === "\xa0\xa0\xa0") {
			const answerRegex = /<em class="correct_response".*?<\/em>/;
			// there is another td with the same id as the clue, which 4 parents up has a div with the answer in a mouseover attribute
         	const answerText = $($(e).parents().eq(3).attr('onmouseover').match(answerRegex)[0]).text();
			cluesList.push({answer: answerText});
			cluesIndex = cluesList.length - 1;
		}
		else if (text) {
			cluesList[cluesIndex].clue = text;
		}
		index++;
	}
	return cluesList;
}

async function scrape() {
    axios(url).then(response => {
        

        const html = response.data;
        const $ = cheerio.load(html);

        // airDate
        const dateRegex = /-.*/;
        const date = new Date($('#game_title > h1').text().match(dateRegex)[0]);
  
        // Iterate through each category name (there should always be a category name even if it's just 1-6)
        $('.category_name').each(function(i, e) {
			
			let category = {}
			category.name = $(e).text();
			category.date = date;
            
            let clues;
            // We need to explicitly check which round the clue is in, not go by category index because some categories might be missing
            if ($('#jeopardy_round').find(e).length === 1) {
				clues = getClues($, i, 'J');
				if (clues) {
					category.clues = clues;
					categories.push(category);
				}
				
            }
            else if ($('#double_jeopardy_round').find(e).length === 1) {
            	clues = getClues($, i - 6, 'DJ');
				if (clues) {
					category.clues = clues;
					categories.push(category);
				}
            }
        });
    	query(categories).catch(console.dir);

    }).catch(console.error);
}

scrape();



async function query(categories) {
    // insertMany categories
  try {
    await client.connect();
    const database = client.db('jarchive');
    const collection = database.collection('categories');
    const result = await collection.insertMany(categories);
    console.log(result);
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}