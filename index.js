// HEROKU INSTANCE: cec-futurecasting

'use strict';

const bodyParser = require('body-parser');
const crypto = require('crypto');
const express = require('express');
const fetch = require('node-fetch');
const request = require('request');
// FOR CONNECTING TO POSTGRES DB (needs pg module installed) -> var pg = require('pg');

const app = express();

let Wit = null;
let log = null;
//let config = null;
try {
  // if running from repo
	Wit = require('../').Wit;
	log = require('../').log;
  //config = require('../').config;
} catch (e) {
	Wit = require('node-wit').Wit;
	log = require('node-wit').log;
  //config = require('node-wit').config;
}

// Webserver parameter
const PORT = process.env.PORT || 5000;

// Wit.ai parameters
const WIT_TOKEN = 'DM6DDFXBIKDQSKJAFKV3YI7FLDWARL4D';

// Messenger API parameters
const FB_PAGE_TOKEN = 'EAAWeAWXpuZCEBAHt2Y2qrrsuThjr3OVPaPOL7RPm0rMrytHixKpAXE8ZCAfgqyUwMK3XJTBa6FxteI4jPa35FZBtoe9BNWSa8r8T7ErxAk9QVSdhxqKPMZCILXxouzjpzZBhXpWS3r3HSSzBLOUZBKBYCrbDkCn6OTIY3ZAAP09lgZDZD';
if (!FB_PAGE_TOKEN) { throw new Error('missing FB_PAGE_TOKEN') }
const FB_APP_SECRET = '050e1ed9174e30aaca3545532fa3227a';
if (!FB_APP_SECRET) { throw new Error('missing FB_APP_SECRET') }

const FB_VERIFY_TOKEN = 'futureb0t';

// ________________________MESSENGER API SPECIFIC CODE________________________

// See the Send API reference
// https://developers.facebook.com/docs/messenger-platform/send-api-reference

const typingBubble = (id, text) => {

    var body = JSON.stringify({
        reciconfigpient: { id },
        "sender_action":"typing_on"
      });

    const qs = 'access_token=' + encodeURIComponent(FB_PAGE_TOKEN);
    return fetch('https://graph.facebook.com/me/messages?' + qs, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body,
    })
    .then(rsp => rsp.json())
    .then(json => {
      if (json.error && json.error.message) {
        throw new Error(json.error.message);
      }
      return json;
    });
};

const fbMessage = (id, text) => {
	
	if(scenarioCombos.trends.indexOf(text) >= 0 || scenarioCombos.disruptions.indexOf(text) >= 0) {

		var body = JSON.stringify({
    		recipient: { id },
    		message: {
    			attachment: {
					  "type": "image",
					  "payload": {
						  "url": text
					  }
				  }
			  },
  		});


	} else {
		var body = JSON.stringify({
    		recipient: { id },
    		message: { text },
  		});
  	}

  	const qs = 'access_token=' + encodeURIComponent(FB_PAGE_TOKEN);
  	return fetch('https://graph.facebook.com/me/messages?' + qs, {
    	method: 'POST',
    	headers: {'Content-Type': 'application/json'},
    	body,
  	})
  	.then(rsp => rsp.json())
  	.then(json => {
    	if (json.error && json.error.message) {
      	throw new Error(json.error.message);
    	}
    	return json;
  	});
};


// _________________________WIT.AI BOT SPECIFIC CODE__________________________

// This will contain all user sessions.
// Each session has an entry:
// sessionId -> {fbid: facebookUserId, context: sessionState}

const sessions = {};

const findOrCreateSession = (fbid) => {
  	let sessionId;
  	// Let's see if we already have a session for the user fbid
  	Object.keys(sessions).forEach(k => {
    	if (sessions[k].fbid === fbid) {
      	// Yep, got it!
      	sessionId = k;
    	}
  	});
  	
  	if (!sessionId) {
    	// No session found for user fbid, let's create a new one
    	sessionId = new Date().toISOString();
    	sessions[sessionId] = {fbid: fbid, context: {}};
  	}
  	return sessionId;
};

var firstEntityValue = function (entities, entity) {
	var val = entities && entities[entity] &&
		Array.isArray(entities[entity]) &&
		entities[entity].length > 0 &&
		entities[entity][0].value

	if (!val) {
		return null
	}
	return typeof val === 'object' ? val.value : val
}

// Our bot actions
const actions = {
  	send({sessionId}, {text}) {
    	// Our bot has something to say!
    	// Let's retrieve the Facebook user whose session belongs to
    	const recipientId = sessions[sessionId].fbid;
    	if (recipientId) {
      	// Yay, we found our recipient!
      	// Let's forward our bot response to her.
      	// We return a promise to let our bot know when we're done sending
      	return typingBubble(recipientId, text), fbMessage(recipientId, text)
      	.then(() => null)
      	.catch((err) => {
        	console.error(
          	'Oops! An error occurred while forwarding the response to',
          	recipientId,
          	':',
          	err.stack || err
        	);
      	});
    	} else {
      	console.error('Oops! Couldn\'t find user for session:', sessionId);
      	// Giving the wheel back to our bot
      	return Promise.resolve()
    	}
  	},
  
// _____________________________CUSTOM ACTIONS________________________________
  
  	saveIndustry ({context, entities}) {
		console.log('EXECUTING SAVE INDUSTRY ACTION')
		return new Promise(function(resolve,reject) {
			var industry = firstEntityValue(entities, 'industry')
			if (industry) {
				console.log('INDUSTRY SAVED: ' + industry)
				context.industryName = industry
			}
			return resolve(context)
		})
	},
	
	['buildScenario']({entities, context}) {
		console.log('EXECUTING BUILD SCENARIO ACTION')
    	return new Promise(function(resolve, reject) {
    		var trendChoice = scenarioCombos['trends']
 			var disruptionChoice = scenarioCombos['disruptions']
			context.trend = trendChoice[Math.floor(Math.random() * trendChoice.length)]
			context.disruption = disruptionChoice[Math.floor(Math.random() * disruptionChoice.length)]
    		return resolve(context)
    	})
    },
    
    swapTrend ({context, entities}) {
		console.log('EXECUTING SWAP TREND ACTION')
		return new Promise(function(resolve,reject) {
			var trendChoice = scenarioCombos['trends']
			context.trend = trendChoice[Math.floor(Math.random() * trendChoice.length)]
			console.log('YOUR NEW TREND IS: ' + context.trend)
			return resolve(context)
		})
	},
	
	swapDisruption ({context, entities}) {
		console.log('EXECUTING SWAP DISRUPTION ACTION')
		return new Promise(function(resolve,reject) {
			var disruptionChoice = scenarioCombos['disruptions']
			context.disruption = disruptionChoice[Math.floor(Math.random() * disruptionChoice.length)]
			console.log('YOUR NEW DISRUPTION IS: ' + context.trend)
			return resolve(context)
		})
	},
    
    saveScenario ({context, entities}) {
		console.log('EXECUTING SAVE SCENARIO ACTION')
		return new Promise(function(resolve,reject) {
			console.log('SCENARIO IS: ' + context.trend + ' / ' + context.disruption)
			return resolve(context)
		})
	},
	
	setScenarioImportance ({context, entities}) {
		console.log('EXECUTING SET SCENARIO IMPORTANCE ACTION')
		return new Promise(function(resolve,reject) {
			var importance = firstEntityValue(entities, 'number')
			console.log(importance)
			if (!importance) {
				importance = 1;
				console.log('0 VOTE BECAME SCENARIO IMPORTANCE RATING: ' + importance)
				context.scenarioImportance = importance
				console.log(context)
			}
			else if (importance) {
				if (importance > 5) {
					importance = 5;
				}
				if (importance < 1) {
					importance = 1;
				}
				console.log('SCENARIO IMPORTANCE RATING: ' + importance)
				context.scenarioImportance = importance
				console.log(context)
			}
			return resolve(context)
		})
	},
	
	setScenarioImminence ({context, entities}) {
		console.log('EXECUTING SET SCENARIO IMMINENCE ACTION')
		return new Promise(function(resolve,reject) {
			var imminence = firstEntityValue(entities, 'number')
			console.log(imminence)
			if (!imminence) {
				imminence = 1;
				console.log('0 VOTE BECAME SCENARIO IMMINENCE RATING: ' + imminence)
				context.scenarioImminence = imminence
				console.log(context)
			}
			else if (imminence) {
				if (imminence > 5) {
					imminence = 5;
				}
				if (imminence < 1) {
					imminence = 1;
				}
				console.log('SCENARIO IMMINENCE RATING: ' + imminence)
				context.scenarioImminence = imminence
				console.log(context)
			}
			return resolve(context)
		})
	},
    
    ['clearContext']({entities, context}) {
		console.log('EXECUTING FINISH SESSION ACTION')
    	return new Promise(function(resolve, reject) {
    		console.log('Ending session, clearing context')
    		delete context.trend;
        delete context.disruption;
        delete context.scenarioImminence;
        delete context.scenarioImportance;
    		return resolve(context)
    	})
    },
  
};

// _______________________SUPPORTING CODE FOR ACTIONS_________________________

var scenarioCombos = {
  trends: [
    'http://imgur.com/tVgu1s2.png',
    'http://imgur.com/yZ49OQU.png',
    'http://imgur.com/N3ywYZ8.png',
    'http://imgur.com/hmxz68i.png',
    'http://imgur.com/D0ZFgUK.png',
    'http://imgur.com/19LErwk.png',
    'http://imgur.com/YSYF7PT.png',
    'http://imgur.com/0mjIFP2.png',
    'http://imgur.com/iRoGT7O.png',
    'http://imgur.com/g7JI8Lm.png',
    'http://imgur.com/ktMMLTQ.png',
    'http://imgur.com/GpOBmaU.png',
    'http://imgur.com/rHGedd6.png',
    'http://imgur.com/uD77RZ0.png',
    'http://imgur.com/3inST5U.png',
    'http://imgur.com/bYKIuzf.png',
    'http://imgur.com/trdjGtx.png',
    'http://imgur.com/0mtEpEx.png',
    'http://imgur.com/fwWusRm.png',
    'http://imgur.com/Fzf9otw.png',
    'http://imgur.com/xnLl4Xe.png',
    'http://imgur.com/Zf7TJTb.png',
    'http://imgur.com/RuW8YcE.png',
    'http://imgur.com/DOnfDOp.png',
    'http://imgur.com/NYU4mkE.png',
    'http://imgur.com/h0IlNro.png',
    'http://imgur.com/trPJ4IE.png',
    'http://imgur.com/uGTPygA.png',
    'http://imgur.com/kjOB22k.png',
  ],

  disruptions: [
    'http://imgur.com/G3YlW3a.png',
    'http://imgur.com/KK4NFW8.png',
    'http://imgur.com/xY8SvDG.png',
    'http://imgur.com/dR9cOSy.png',
    'http://imgur.com/3bjSEvr.png',
    'http://imgur.com/aJILTm7.png',
    'http://imgur.com/vK8aZ47.png',
    'http://imgur.com/yeew7ay.png',
    'http://imgur.com/xjOvuwC.png',
    'http://imgur.com/MKqVSc6.png',
    'http://imgur.com/a2tZ3ug.png',
    'http://imgur.com/w1nnTfg.png',
    'http://imgur.com/pHRGFc7.png',
    'http://imgur.com/t7X32oc.png',
    'http://imgur.com/aWIMU0X.png',
    'http://imgur.com/oKdQLVX.png',
    'http://imgur.com/lBTyoeM.png',
  ],

  default: [
    'DEFAULT',
  ],
};

// _____________________________INITIALISING BOT______________________________

const wit = new Wit({
  	accessToken: WIT_TOKEN,
  	actions,
  	logger: new log.Logger(log.INFO)
});

// ____________________________STARTING WEB SERVER____________________________

app.use(({method, url}, rsp, next) => {
  	rsp.on('finish', () => {
    	console.log(`${rsp.statusCode} ${method} ${url}`);
  	});
  	next();
});

app.use(bodyParser.json({ verify: verifyRequestSignature }));

app.get('/', (req, res) =>{
    res.send('I\'m the little bot that\'s going to make you think hard about your future...');
});

// Webhook setup
app.get('/webhook', (req, res) => {
  	if (req.query['hub.mode'] === 'subscribe' &&
    	req.query['hub.verify_token'] === FB_VERIFY_TOKEN) {
    	res.send(req.query['hub.challenge']);
  	} else {
    	res.sendStatus(400);
  	}
});

// Message handler
app.post('/webhook', (req, res) => {
  // Parse the Messenger payload
  // See the Webhook reference
  // https://developers.facebook.com/docs/messenger-platform/webhook-reference
  	const data = req.body;

  	if (data.object === 'page') {
    	data.entry.forEach(entry => {
      	entry.messaging.forEach(event => {
        	if (event.message) {
          		// Yay! We got a new message!
          		// We retrieve the Facebook user ID of the sender
          		const sender = event.sender.id;

          		// We retrieve the user's current session, or create one if it doesn't exist
          		// This is needed for our bot to figure out the conversation history
          		const sessionId = findOrCreateSession(sender);

          		// We retrieve the message content
          		const {text, attachments} = event.message;

              const maxSteps = 5;

          			if (attachments) {
            			// We received an attachment
            			// Let's reply with an automatic message
            			fbMessage(sender, 'Sorry I can only process text messages for now.')
            			.catch(console.error);
          			} else if (text) {
            			// We received a text message

            			// Let's forward the message to the Wit.ai Bot Engine
            			// This will run all actions until our bot has nothing left to do
            			wit.runActions(
              				sessionId, // the user's current session
              				text, // the user's message
              				sessions[sessionId].context, // the user's current session state
                      maxSteps
            			).then((context) => {
              				// Our bot did everything it has to do.
              				// Now it's waiting for further messages to proceed.
              				console.log('Waiting for next user messages');

                      // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

              				// Based on the session state, you might want to reset the session.
             				// This depends heavily on the business logic of your bot.
              				// Example:
              				// if (context['done']) {
              				//   delete sessions[sessionId];
              				// }

                      // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

              				// Updating the user's current session state
              				sessions[sessionId].context = context;
            			})
            			.catch((err) => {
              				console.error('Oops! Got an error from Wit: ', err.stack || err);
            			})
          			}
        		} else {
          			console.log('received event', JSON.stringify(event));
        		}
      		});
    	});
  	}
  	res.sendStatus(200);
});

/*
 * Verify that the callback came from Facebook. Using the App Secret from
 * the App Dashboard, we can verify the signature that is sent with each
 * callback in the x-hub-signature field, located in the header.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */
function verifyRequestSignature(req, res, buf) {
  	var signature = req.headers["x-hub-signature"];

  	if (!signature) {
    	// For testing, let's log an error. In production, you should throw an
    	// error.
    	console.error("Couldn't validate the signature.");
  	} else {
    	var elements = signature.split('=');
    	var method = elements[0];
    	var signatureHash = elements[1];

    	var expectedHash = crypto.createHmac('sha1', FB_APP_SECRET)
                        	.update(buf)
                        	.digest('hex');

    	if (signatureHash != expectedHash) {
      		throw new Error("Couldn't validate the request signature.");
    	}
  	}
}

app.listen(PORT);
console.log('Listening on :' + PORT + '...');