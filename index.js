const { MongoClient } = require("mongodb");
const axios = require('axios');
const cheerio = require('cheerio');

const url = require("./config.json").url;
const client = new MongoClient(url);
// show that aired on 2010-01-01
let id = 3449;
// Send mongo query
async function query(categories) {
    // insertMany categories
  try {
    await client.connect();
    const database = client.db('Jeopardy');
    const collection = database.collection('Categories');
    const result = await collection.insertMany(categories);
    console.log(result);
  } catch (error) {
	console.log(error);
  } finally {
	// Wait just to not overload servers too much
	categories.length = 0;
	promises.length = 0;
	await new Promise(resolve => setTimeout(resolve, 1000));
    // Ensures that the client will close when you finish/error
	client.close();
	if (id < 7344) {
		console.log(`current id: ${id}`);
		id += 5;
		scrape();
	}
	else {
		await client.close();
	}
  }
}

// Get clues for category given which round and category index
// This asssumes that if we have the correct number of valid clues, we have an answer for each clue
function getClues($, i, which) {
	// clue_(J or DJ)_i
	clues = $("td[id^='clue_" + which + "_" + (i + 1) + "']").toArray();

	// Need to have 5 clues or don't put the category in
	if (clues.length != 10) {
		return false;
	}

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
			cluesList[cluesIndex].question = text;
		}
		index++;
	}
	return cluesList;
}

let promises = [];
let categories = [];

async function scrape() {
	for (let i = id; i < (id + 5); i++) {
		
		promises.push(
			axios({method: 'get', url: 'https://www.j-archive.com/showgame.php?game_id=' + i}).then(response => {
				
				const html = response.data;
				const $ = cheerio.load(html);

				// airDate
				const dateRegex = /-.*/;
				const date = new Date($('#game_title > h1').text().match(dateRegex)[0]);

				// Iterate through each category name (there should always be a category name even if it's just 1-6)
				$('.category_name').each(function (i, e) {

					let category = {}
					category.Name = $(e).text();
					category.AirDate = date;

					let clues;
					// We need to explicitly check which round the clue is in, not go by category index because some categories might be missing
					// 2 days later me realizes that even if clues in the category are missing there will still be a category name so ^ is incorrect
					if ($('#jeopardy_round').find(e).length === 1) {
						clues = getClues($, i, 'J');
						if (clues && category.AirDate > new Date('2010-01-01')) {
							category.Clues = clues;
							categories.push(category);
						}

					}
					else if ($('#double_jeopardy_round').find(e).length === 1) {
						clues = getClues($, i - 6, 'DJ');
						if (clues && category.AirDate > new Date('2010-01-01')) {
							category.Clues = clues;
							categories.push(category);
						}
					}

					// else if ($('#final_jeopardy_round')) {
					// 	let final = {};
					// 	final.name = category.name;
					// 	final.clue = $('#clue_FJ').text();
					// 	const answerRegex = /<em class=.*?<\/em>/;
					// 	final.answer = $($('#clue_FJ').parents().eq(6).find('div').attr('onmouseover').match(answerRegex)[0]).text();
					// 	final.type = "final";
					// 	final.date = date;
					// 	if (final.clue) {
					// 		categories.push(final);
					// 	}
					// }
				});

			}).catch(console.error)
		);
	}

	Promise.all(promises).then(() => {
		query(categories);
	});
		
}

scrape();
