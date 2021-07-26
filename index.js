const fs = require("fs");
const eris = require("eris");
const schedule = require("node-schedule");
const stream = require("stream");
const files = [];

const config = require("./config.json");

const bot = new eris(config.token);

let playing = false;

bot.on("messageCreate", (message) => {
  // console.log(message.content);
  if (!message.author.bot && message.content === "ct!toggle") {
    let id = message.channel.guild.id;
    if (config.enabled_guilds.includes(id)) {
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
    play(file, listenableChannels[0]);
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

async function play(file, channelID) {
  while (playing) {}
  const resource = stream.Readable.from(file);
  let conn = await bot.joinVoiceChannel(channelID);
  playing = true;
  conn.play(resource);
  conn.on("end", () => {
    playing = false;
    bot.leaveVoiceChannel(channelID);
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
    for (let channelID of listenableChannels) {
      // console.log(`joining channel ${channelID} to play`);
      await play(file, channelID);
    }
  });
});

// max 24
for (let i = 0; i < (parseInt(config.sound_number) || 12); i++) {
  files.push(`./sounds/westminster_${i + 1}.mp3`);
}

bot.connect();
