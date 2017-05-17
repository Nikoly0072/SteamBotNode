'use strict';
// Dependencies
var Winston = require('winston');                               // Saving logs and displaying debug messages
var SteamUser = require('steam-user');                          // Steam client
var Community = require('steamcommunity');                      // Steam Community
var TradeOfferManager = require('steam-tradeoffer-manager');    // Steam tradeoffer manager
var cleverbot = require('cleverbot.io');                        // CleverBot
var fs = require('fs');                                         // Files System
var util = require('util');                                     // Util, not used atm, only for debuging
var request = require('request');                               // Request html from a website
var config = require('./config.js');                            // Config file, !!! change it to json !!!

var client = [];
var community = [];
var manager = [];
var commandStatus = [];


var bot = new cleverbot(config.cleverbot.user, config.cleverbot.key);
bot.setNick('QasdeChatBot');
bot.create((err, session) => {
    if (err) {
        logger.error(`Error creating CleverBot session: ${err}`);
    } else {
        logger.debug(`Created CleverBot session: ${session}`);
    }
});

var game = config.games;

var note = {};
var JSONnote = '';

var appid = {                                                   // App ids
    Csgo: 730,
    Steam: 753
};

var contextid = {                                               // Context id for trading
    Csgo: 2,
    Steam: 6
};

/* CommandStatus = {
    question: true,
    note: false,
    random: false,
    define: true,
    hug: true,
    add: true,
    help: true,
    youtube: true
};*/

function CommandStatus() {
    this.question = true,
    this.note = true,
    this.random = false,
    this.choose = true,
    this.define = true,
    this.translate = false,
    this.bot = true,
    this.hug = true,
    this.insult = false,
    this.slap = true,
    this.add = true,
    this.group = true,
    this.help = true,
    this.youtube = true
}

var questionAnswers = [
    'Yes',
    'No',
    'Probably',
    'Probably not',
    'Maybe',
    '100%',
    'I doubt it',
    'I don\'t know',
    'Unlikely',
    'Most likely',
    'Never',//
];

var insultList = [
    [`Fuck you `, '!'],
    ['', ' smells like trash.'],
    ['', ' you mom gay.'],
    ['', ' is a clinking, clanking, clattering collection of caliginous junk.'],
    ['', ' is nothing. If he was in my toilet I wouldn\'t bother flushing it.'],
    ['', ' is a meat-headed shit sack'],
    ['Best part of ', ' ran down the crack of his momma’s ass and ended up as a brown stain on the mattress'],
    ['End your life ', '.'],
    ['',' is a one ugly motherfucker.'],
    ['',' is so ugly he could be a modern art masterpiece.'],
    ['Scuse me ', ', is that your nose or did a bus park on your face?'],
    ['','? More like the abortion that lived.'],
    ['', ', you miserable shit eating autist, how do you live knowing you will never change?'],
    ['',' should clone himself, so he can fuck himself.'],
    /*['',' is a no business, born insecure junkyard mother fucker.'],*/

];

var logger = new Winston.Logger({                               // Setup new logger
    transports: [
        new Winston.transports.Console({
            colorize: true,
            level: 'debug'
        }),
        new Winston.transports.File({
            level: 'info',
            timestamp: true,
            filename: 'log.log',
            json: false
        })
    ]
});

/*var client = new SteamUser();                                   // New Steam client
var offers = new TradeOfferManager({                            // Setup new Steam offer managqer
    steam: client,                                     // Use Steam client
    domain: config.domain,                              // Domain
    language: 'en',                                       // English item desciptions
    pollInterval: 10000,                                      // Poll every 10s
    cancelTime: 300000                                      // Expire after 5 min
});*/


fs.readFile('Polldata.json', (err, data) => {                   // Save polldata for later sessions if crashed or something idk
    if (err) {
        logger.warn(`Error reading Polldata.json. If this is the first run, this is expected behavior: ${err}`);
    } else {
        logger.debug('Found previous trade offer poll data. Importing it to keep running smoothly.');
        offer.pollData = JSON.parse(data);
    }
});

// initialize clients
var initializeClients = (logins) => {
    for (var i in logins) {
        initializeClient(i);
    }
}

var initializeClient = (index) => {
    client[index] = new SteamUser();
    community[index] = new Community();
    manager[index] = new TradeOfferManager({                            // Setup new Steam offermanager
        steam: client[index],                                     // Use Steam client
        domain: config.domain,                              // Domain
        language: 'en',                                       // English item desciptions
        pollInterval: 10000,                                      // Poll every 10s
        cancelTime: 300000                                      // Expire after 5 min
    });
    commandStatus[index] = new CommandStatus();

    // Event part of code

// Account
    client[index].on('loggedOn', (details) => {                            // on logged on
        logger.info(`[${client[index]._logOnDetails.account_name}] Logged into Steam as ${client[index].steamID.getSteam3RenderedID()}`);
        client[index].setPersona(SteamUser.EPersonaState.Online);      // Become online
        client[index].gamesPlayed(game);
    });

    client[index].on('error', (e) => {                                     // login error
        logger.error(`[${client[index]._logOnDetails.account_name}] ${e}`);
        process.exit(1);
    });

    client[index].on('webSession', (sessionID, cookies) => {               // Connected to Steam ommunity
        logger.debug(`[${client[index]._logOnDetails.account_name}] Got a web session.`);
        manager[index].setCookies(cookies, (err) => {
            if (err) {
                logger.error(`[${client[index]._logOnDetails.account_name}] Unable to set trade offer cookies: ${err}`);
                //process.exit(1);
            } else {
                logger.debug(`[${client[index]._logOnDetails.account_name}] Trade offer cookies set. Got API Key: ${manager[index].apiKey}`);
            }
        });
        community[index].setCookies(cookies, (err) => {
            if (err) {
                logger.error(`[${client[index]._logOnDetails.account_name}] ${err}`);
            } else {
                logger.debug(`[${client[index]._logOnDetails.account_name}] Steam Community cookies set`);
            }
        });
        for (var i in client[index].myGroups) {
            client[index].joinChat(i);
        }
        
    });

    client[index].on('emailInfo', (address, validated) => {                // Email changed
        logger.info(`[${client[index]._logOnDetails.account_name}] Our emails address is ${address} and it's ${(validated ? "validated" : "not validated")}`);
    });

    client[index].on('accountLimitations', (limited, communityBanned, locked, canInviteFriends) => {   // Looking for account limitations
        if (limited) {
            logger.warn(`[${client[index]._logOnDetails.account_name}] This account is limited! Can\'t send friend invites, use market, open group chat, or acces the web API.`);
        }
        if (communityBanned) {
            logger.warn(`[${client[index]._logOnDetails.account_name}] This account is banned from Steam Community!`);
        }
        if (locked) {
            logger.error(`[${client[index]._logOnDetails.account_choosename}] This account is locked! Cannot trade/gift/purchase items, play on VAC servers or access Steam Community! Shutting down.`);
            process.exit(1);
        }
        if (!canInviteFriends) {
            logger.warn(`[${client[index]._logOnDetails.account_name}] This account is unable to send friend requests!`);
        }
    });

// Friends
    // Invited to group chat
    client[index].on('chatInvite', (inviterID, chatID, chatName) => {      
        logger.info(`[${client[index]._logOnDetails.account_name}] Invited to chat : ${chatName} (${chatID})`);
        client[index].joinChat(chatID);
    });

    // Entered group chat
    client[index].on('chatEnter', (chatID, response) => {

        client[index].chatMessage(chatID, 'Hi');
        logger.debug(`[${client[index]._logOnDetails.account_name}] Joined Chat: ${chatID}`);

    });

    //clean up and separate commands for staff and for everyone
    client[index].on('chatMessage', (chatID, userID, message) => {
        if (message.startsWith('/')) {
            // Get sender rank in room, if friend chat return 0
            try {
                var senderRank = client[index].chats[chatID].members[userID].rank;
            }
            catch (err) {
                senderRank = 0;
            }
            try {
                var myRank = client[index].chats[chatID].members[client[index].SteamID].rank;
            }
            catch (err) {
                myRank = 0;
            }
        var userID64 = userID.getSteamID64();
        //q
            if (message.toLowerCase().startsWith('/q ') && commandStatus[index].question) {

                logger.info(`[${client[index]._logOnDetails.account_name}] Recieved "/q" command. user: ${client[index].users[userID64].player_name} (${userID64})`);

                client[index].chatMessage(chatID, questionAnswers[Math.floor(Math.random() * questionAnswers.length)]);
        //note
            } else if (message.toLowerCase().startsWith('/note') && commandStatus[index].note) {

                logger.info(`[${client[index]._logOnDetails.account_name}] Recieved "/note" (${message}) command. user: ${client[index].users[userID64].player_name} (${userID64})`);

                var noteArray = [];
                noteArray = message.match(/^\/note ?(\S*) ?(.*)/i);

                if (noteArray[2]) {
                    if (!(message.includes('youtu') || !(noteArray[2].match(/(http:\/\/|https:\/\/)?(www\.)?(\S+?)\.((\S)+)/i)))) {

                    } else {
                        note[noteArray[1]] = noteArray[2];

                        fs.writeFile('Notes.json', JSON.stringify(note), (err) => {
                            if (err) {
                                logger.error(`[${client[index]._logOnDetails.account_name}] ${err}`);
                            }

                            client[index].chatMessage(chatID, 'Note set!');

                        });
                    }

                } else if (noteArray[1]) {

                    if (note.hasOwnProperty(noteArray[1].toLowerCase())) {
                        client[index].chatMessage(chatID, note[noteArray[1]]);
                    } else {
                        client[index].chatMessage(chatID, 'Note doesn\'t exist!');
                    }

                } else {

                    client[index].chatMessage(chatID, 'Syntax error: /note <name> [value]');

                }
        //random
            } else if (message.toLowerCase().startsWith('/random') && commandStatus[index].random && (senderRank === SteamUser.EClanPermission.OwnerOfficerModerator || userID64 === config.owner || config.admins.includes(userID64))) {

                logger.info(`[${client[index]._logOnDetails.account_name}] Recieved "/random" command. user: ${client[index].users[userID].player_name} (${userID})`);

                var membersInChat = client[index].chats[chatID].members;
                var randomPlayer = Math.floor(Math.random() * Object.keys(membersInChat).length);
                var winner = client[index].users[Object.keys(membersInChat)[randomPlayer]].player_name;
                client[index].chatMessage(chatID, `The winner is ${winner}`);

        //choose
            } else if (message.toLowerCase().startsWith('/choose') && commandStatus[index].choose) {
                
                logger.info(`[${client[index]._logOnDetails.account_name}] Recieved "/choose" command. user: ${client[index].users[userID].player_name} (${userID})`);


                var items = message.match(/^\/choose(( \S+){2,})/i);
                if (items) {

                    var choiceList = items[1].split(' ');
                    choiceList.shift();
                    var choice = choiceList[Math.floor(Math.random() * (choiceList.length))];
                    client[index].chatMessage(chatID, `I choose ${choice}`);

                } else {

                    client[index].chatMessage(chatID, 'I don\'t think you understand how this works.');

                }
            
        //define
            } else if (message.toLowerCase().startsWith('/define ') && commandStatus[index].define) {
                logger.info(`[${client[index]._logOnDetails.account_name}] Recieved "/define" (${message}) command. user: ${client[index].users[userID].player_name} (${userID})`);

                var word = message.match(/^\/define (.+)/i);
                if (word) {
                    word = word[1];
                }
                request(`http://api.urbandictionary.com/v0/define?term=${word}`, (err, response, body) => {
                    if (err) {
                        logger.error(`[${client[index]._logOnDetails.account_name}] ${err}`);
                    } else {
                        var definition = JSON.parse(body);
                        if (definition.result_type === 'exact') {
                            client[index].chatMessage(chatID, `${definition.list[0].word}.: ${definition.list[0].definition}`);
                        } else {
                            client[index].chatMessage(chatID, 'Definition not found.');
                        }
                    }
                    
                });

        //Translate
            } else if (message.startsWith('/t ') && commandStatus[index].translate) {

                var text = message.match(/^\/t ((\S*) )?(\S+) ('|")(.+)('|")/i);

                if (text[0]) {
                    console.log(`https://www.googleapis.com/language/translate/v2?q=${text[5]}${text[2] ? `&source=${text[2]}` : ''}&target=${text[3]}&key=${config.googleAPI}`);
                    request(`https://www.googleapis.com/language/translate/v2?q=${text[5]}${text[2] ? `&source=${text[2]}` : ''}&target=${text[3]}&key=${config.googleAPI}`, (err, response, body) => {
                        if (err) {
                            client[index].chatMessage(chatID, 'Syntax error: /t <source lang> [target lang] [\"Message\"]');
                        } else {
                            var translation = JSON.parse(body);
                            if (translation.hasOwnProperty('data')) {
                                client[index].chatMessage(chatID, `${client[index]._logOnDetails.account_name}: ${translation.data.translations[0].translatedText}`);
                            } else {
                                client[index].chatMessage(chatID, 'did you use correct language name/code?');
                            }
                        }
                    });
                } else {
                    client[index].chatMessage(chatID, 'Syntax error: /t <source lang> [target lang] [\"Message\"]');
                }

        //"Clever"bot
            } else if (message.toLowerCase().startsWith('/b ') && commandStatus[index].bot) {

                bot.ask(message.substring(3), (err, response) => {
                    if (err) {
                        logger.error(`[${client[index]._logOnDetails.account_name}] ${err}`);
                    } else {

                        logger.info(`[${client[index]._logOnDetails.account_name}] Recieved "/b" (${message}) command. user: ${client[index].users[userID64].player_name} (${userID64})`);

                        client[index].chatMessage(chatID, response);
                    }
                });

        //hug
            } else if (message.toLowerCase().startsWith('/hug') && commandStatus[index].hug) {

                logger.info(`[${client[index]._logOnDetails.account_name}] Recieved "/hug" command. user: ${client[index].users[userID64].player_name} (${userID64})`);

                client[index].chatMessage(chatID, `*Hugs ${client[index].users[userID64].player_name} <3*`);

        //insult
            } else if (message.toLowerCase().startsWith('/insult') && commandStatus[index].insult) {

                var target = message.match(/^\/insult (.+)/i);

                var insult = insultList[Math.floor(Math.random() * insultList.length)];

                if (target) {
                    client[index].chatMessage(chatID, insult.join(target[1]));
                } else {
                    client[index].chatMessage(chatID, insult.join(client[index].users[userID64].player_name));
                }

        //slap
            } else if (message.toLowerCase().startsWith('/slap') && commandStatus[index].slap) {

                logger.info(`[${client[index]._logOnDetails.account_name}] Recieved "/slap" command. user: ${client[index].users[userID64].player_name} (${userID64})`);
                
                var target = message.match(/^\/slaps? (.+)/i);

                if (target) {
                    client[index].chatMessage(chatID, `*Slaps ${target[1]}*`);
                } else {
                client[index].chatMessage(chatID, `*Slaps ${client[index].users[userID64].player_name}*`);
                }

        //add
            } else if (message.toLowerCase() === '/add' && commandStatus[index].add) {

                client[index].addFriend(userID, (err, name) => {
                    if (err) {
                        if (err) {
                            client[index].chatMessage(chatID, `${client[index].users[userID64].player_name} you are already in my friends list.`); //name doesnt work here
                        } else {
                            logger.error(`[${client[index]._logOnDetails.account_name}] ${err}`);
                        }
                    } else {

                        logger.info(`[${client[index]._logOnDetails.account_name}] recieved "/add" command ${name} (${userID64})`);

                        client[index].chatMessage(chatID, `Added ${name} to my friend list`);
                    }

                });

        //group
            } else if (message.toLowerCase() === '/group' && commandStatus[index].group) {

                logger.info(`[${client[index]._logOnDetails.account_name}] recieved "/group" command ${client[index].users[userID64].player_name} (${userID64})`);

                client[index].inviteToGroup(userID64, '103582791458084036');
                

        //status
            } else if (message.startsWith('\/status')) {
                var status = '\n';
                for (var i in commandStatus[index]) {
                    status += `${i.length >= 7 ? `${i}:` : `${i}:\t`}\t${commandStatus[index][i] ? 'Enabled' : 'Disabled'}\n`;
                }
                client[index].chatMessage(chatID, status);

        //help
            } else if (message.startsWith('\/help') && commandStatus[index].help) {

                client[index].chatMessage(chatID, '\n/help - displays this message\n/add - add me to friends\n/b [message] - talk to me : ^)\n/choose [word] [word]...\n/define [word] - ask for definition\n/group - get invite to Yaoi bot group\n/hug - hugs : ^)\n/leave[chat/group] (there is no space) - mod+admin/admin only\n/note [name] <value> sets a note for [name]\n/random - chooses random user in chat (currently not working, moderator and admin only)\n/slap <user> - slaps you or <user>');

        //leave
            } else if (message.toLowerCase().startsWith('/leave') && (senderRank === SteamUser.EClanPermission.OwnerOfficerModerator || userID64 === config.owner || config.admins.includes(userID64))) {
                if (message.toLowerCase() === '/leavegroup' && !(!(userID64 === config.owner || config.admins.includes(userID64)) && senderRank === SteamUser.EClanPermission.Moderator)) {
                    logger.info(`[${client[index]._logOnDetails.account_name}] Left Group: ${client[index].chats[chatID].name} (${chatID})`);
                    community[index].leaveGroup(chatID);
                } else if (message.toLowerCase() === '/leavechat') {
                    logger.info(`[${client[index]._logOnDetails.account_name}] Left Chat: ${client[index].chats[chatID].name} (${chatID})`);
                    client[index].leaveChat(chatID);
                }

        //toggle
            } else if (message.toLowerCase().startsWith('/toggle') && (userID64 === config.owner || config.admins.includes(userID64))) {
                var command = message.match(/^\/toggle (.+)/i);
                if (Object.keys(commandStatus[index]).includes(command[1])) {
                    commandStatus[index][command[1]] = !(commandStatus[index][command[1]]);
                    if (commandStatus[index][command[1]] === true) {
                        logger.warn(`[${client[index]._logOnDetails.account_name}] ${command[1]} command has been turned on.`);
                    } else {
                        logger.warn(`[${client[index]._logOnDetails.account_name}] ${command[1]} command has been turned off.`);
                    }
                } else {
                    client[index].chatMessage(chatID, 'This command doesn\'t exist');
                }

        //debug
            } else if (message.startsWith('/debug') && userID64 == config.owner) {
                //console.log(util.inspect(/*client[index]*/community[index], false, null));
                console.log(util.inspect(/*client[index]*/client[index].chats, true, null, true));
            }


        } else {
        //youtube
            if ((message.toLowerCase().includes('https://youtu.be/') || message.toLowerCase().includes('www.youtube.com/watch?v=')) && commandStatus[index].youtube) {
                var link = message.match(/(https:\/\/youtu.be\/|https?:\/\/www.youtube.com\/watch\?v=)\S+/i);
                request(link[0], (err, response, body) => {
                    if (err) {
                        logger.error(`[${client[index]._logOnDetails.account_name}] ${err}`);
                    } else {
                        var title = body.match(/<title>(.*?)<\/title>/);
                        client[index].chatMessage(chatID, title[1]);
                    }
                });
            }
        }
    });

    client[index].on('chatUserJoined', (chatID, userID) => {
        client[index].chatMessage(chatID, `Hi ${client[index].users[userID].player_name}!`);
    });

    /*client[index].on('chatUserLeft', (chatID, userID) => {
        client[index].chatMessage(chatID, 'Bye!')
    });*/

    client[index].on(`friendOrChatMessage#${config.owner}`, (userID, message, chatID) => {

        if (message.startsWith('/changename')) {
            var name = message.match(/^\/changename (.+)/i)[1];
            logger.info(`[${client[index]._logOnDetails.account_name}] Changing name to: '${name}'`);
            client[index].setPersona(SteamUser.EPersonaState.Online, name);
        }

    });

    client[index].on('groupRelationship', (groupID, relationship) => {

        if (relationship === SteamUser.EClanRelationship.Invited) {
            logger.info(`[${client[index]._logOnDetails.account_name}] Added to gorup: ${groupID}`);
            client[index].respondToGroupInvite(groupID, true); // change to variable and toggle
        } else if (relationship === SteamUser.EClanRelationship.Kicked) {
            logger.info(`[${client[index]._logOnDetails.account_name}] Kicked from gorup: ${groupID}`);
        }

    });

    client[index].on('newComments', () => {

    });

// Trading
    client[index].on('wallet', (hasWallet, currency, balance) => {         // Checks if wallet exists
        if (hasWallet) {
            logger.info(`[${client[index]._logOnDetails.account_name}] We have ${SteamUser.formatCurrency(balance, currency)} Steam wallet remaining`);
        } else {
            logger.info(`[${client[index]._logOnDetails.account_name}] We don\'t have a Steam wallet.`);
        }
    });

    client[index].on('newItems', (count) => {                              // Recieved new items
        logger.info(`[${client[index]._logOnDetails.account_name}] ${count} new items in our inventory`);
    });

    //client[index].on('newOffer',)

    fs.readFile('Notes.json', (err, data) => {
        if (err) {
            logger.error(`[${client[index]._logOnDetails.account_name}] ${err}`);
        }
        note = JSON.parse(data);
    });

// Login
    client[index].logOn({
        accountName: config.account[index].username,
        password: config.account[index].password
    });
}
//
initializeClients(config.account);
