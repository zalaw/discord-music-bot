require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  getVoiceConnection,
} = require("@discordjs/voice");
const ytdl = require("ytdl-core");
const yts = require("yt-search");

const queue = [];
let botVoiceChannelId = null;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.once("ready", () => {
  console.log("Bot ready");
});

client.on("voiceStateUpdate", (oldState, newState) => {
  if (oldState.member?.user.bot) {
    botVoiceChannelId = newState.channelId;
  }
});

client.on("messageCreate", async message => {
  try {
    const { content } = message;
    const { channel: userVoiceChannel } = message.member.voice;

    if (content.startsWith("!play")) {
      if (!userVoiceChannel) {
        return await message.channel.send("You need to join a voice channel first!");
      }

      if (botVoiceChannelId && botVoiceChannelId !== userVoiceChannel.id) {
        return await message.channel.send("Bot is already in another voice channel!");
      }

      let [command, ...args] = content.trim().split(/\s+/);

      let url = args;

      if (!args.includes("youtube.com")) {
        const data = await yts(args.join(" "));
        url = data.all[0].url;
      }

      // const connection = joinVoiceChannel({
      //   channelId: userVoiceChannel.id,
      //   guildId: userVoiceChannel.guild.id,
      //   adapterCreator: userVoiceChannel.guild.voiceAdapterCreator,
      //   selfDeaf: false,
      // });

      // const stream = ytdl(url, { filter: "audioonly" });
      // const resource = createAudioResource(stream);
      // const player = createAudioPlayer();

      // connection.subscribe(player);
      // player.play(resource);

      // player.on(AudioPlayerStatus.Idle, () => {
      //   connection.destroy();
      // });

      queue.push({ url, userVoiceChannel, message });

      if (queue.length === 1) {
        play(queue[0]);
        await message.channel.send(`Now playing ${args.join(" ")}`);
      } else {
        await message.channel.send(`Added ${args.join(" ")} to the queue!`);
      }
    } else if (content.startsWith("!skip")) {
      if (queue.length === 0) return;

      skip();
    } else if (content.startsWith("!stop")) {
      if (botVoiceChannelId && botVoiceChannelId !== userVoiceChannel.id) return;

      const connection = getVoiceConnection(userVoiceChannel.guild.id);

      if (connection) {
        connection.destroy();
        queue.splice(0, queue.length);
      }
    }
  } catch (e) {
    console.log(e);
  }
});

async function play(track) {
  const { url, userVoiceChannel, message } = track;

  if (!userVoiceChannel) return await message.channel.send("You need to join a voice channel first!");

  const connection = joinVoiceChannel({
    channelId: userVoiceChannel.id,
    guildId: userVoiceChannel.guild.id,
    adapterCreator: userVoiceChannel.guild.voiceAdapterCreator,
    selfDeaf: false,
  });

  const stream = ytdl(url, { filter: "audioonly" });
  const resource = createAudioResource(stream);
  const player = createAudioPlayer();

  connection.subscribe(player);
  player.play(resource);

  player.on(AudioPlayerStatus.Idle, () => {
    connection.destroy();
    queue.shift();
    if (queue.length > 0) {
      play(queue[0]);
    }
  });
}

async function skip() {
  if (queue.length === 0) return;

  const { userVoiceChannel, message } = queue[0];
  const connection = getVoiceConnection(userVoiceChannel.guild.id);

  connection.destroy();
  queue.shift();

  if (queue.length > 0) {
    play(queue[0]);
  }
}

client.login(process.env.TOKEN);
