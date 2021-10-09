const fs = require("fs");
const eris = require("eris");
const schedule = require("node-schedule");
const stream = require("stream");
const files = [];

const config = require("./config.json");

const bot = new eris(config.token);

let playing = false;

let channelQueue = {};

bot.on("messageCreate", (message) => {
  // console.log(message.content);
  if (!message.author.bot && message.content === "ct!toggle") {
    let id = message.channel.guild.id;
    if (
      message.author.id !== "123601647258697730" &&
      message.author.id !== "164469624463818752"
    ) {
      message.channel.createMessage("https://i.hailsatan.co/i/y11cefrx.png");
    } else if (config.enabled_guilds.includes(id)) {
      console.log(`disabled for guild ${id}`);
      config.enabled_guilds.splice(config.enabled_guilds.indexOf(id), 1);
      message.channel.createMessage("disabled");
    } else {
      console.log(`enabled for guild ${id}`);
      config.enabled_guilds.push(id);
      message.channel.createMessage("enabled");
    }
    fs.writeFileSync("./config.json", JSON.stringify(config));
  }
  if (!message.author.bot && message.content === "ct!ply") {
    if (!message.member) {
      return;
    }
    let listenableChannels = message.channel.guild.voiceStates
      .filter((state) => !state.deaf && !state.selfDeaf)
      .map((state) => state.channelID)
      .filter((value, index, self) => index === self.indexOf(value));
    if (!listenableChannels.length) {
      message.channel.createMessage("idk");
      return;
    }
    let currentHour =
      new Date().getHours() % (parseInt(config.sound_number) || 12);
    let filePath = getFilePath(currentHour);
    const file = fs.readFileSync(filePath);
    play(file, listenableChannels);
  }
});

bot.on("ready", () => {
  console.log("ready");
});

function getFilePath(currentHour) {
  let filePath = files[0];
  if (files.length >= currentHour) {
    filePath =
      files[currentHour - 1 < 0 ? config.sound_number - 1 : currentHour - 1];
  } else {
    console.warn(`could not get filename for hour ${currentHour}`);
  }
  return filePath;
}

async function play(file, channelIDs) {
  if (!Array.isArray(channelIDs)) {
    bot.leaveVoiceChannel(channelIDs[0]);
    return;
  } else if (!channelIDs[0] && channelIDs.length > 1) {
    bot.leaveVoiceChannel(channelIDs[0]);
    play(file, channelIDs.slice(1, channelIDs.length));
  }
  const resource = stream.Readable.from(file);
  // console.log(`joining channel ${channelIDs[0]} to play`);
  let conn = await bot.joinVoiceChannel(channelIDs[0]);
  playing = true;
  conn.play(resource);
  conn.on("end", () => {
    playing = false;
    bot.leaveVoiceChannel(channelIDs[0]);
    if (channelIDs.length > 1) {
      play(file, channelIDs.slice(1, channelIDs.length));
    }
  });
}

// set to 0 * * * *
const job = schedule.scheduleJob("0 * * * *", (fireDate) => {
  let currentHour =
    new Date().getHours() % (parseInt(config.sound_number) || 12);
  console.log(`chimed ${currentHour} times at ${fireDate}.`);

  let filePath = getFilePath(currentHour);
  const file = fs.readFileSync(filePath);
  // console.log(filePath, file);
  config.enabled_guilds.forEach(async (id) => {
    // console.log(`start chiming in guild ${id}`);
    let guild = bot.guilds.get(id);

    // list of channels which have undeafened users in them
    let listenableChannels = guild.voiceStates
      .filter((state) => !state.deaf && !state.selfDeaf)
      .map((state) => state.channelID)
      .filter((value, index, self) => index === self.indexOf(value));
    await play(file, listenableChannels);
  });
});

// max 24
for (let i = 0; i < (parseInt(config.sound_number) || 12); i++) {
  files.push(`./sounds/westminster_${i + 1}.mp3`);
}

bot.connect();
