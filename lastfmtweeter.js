/* eslint-disable no-console */
const Twitter = require('twitter-lite');
const env = require('dotenv');
const fetch = require('node-fetch');

env.config();

const twitter = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_TOKEN_KEY,
  access_token_secret: process.env.TWITTER_TOKEN_SECRET,
});

const userName = process.env.LASTFM_USERNAME;
const initialArtistNumber = 6;
const defaultTimePeriod = 'week';

const getPunc = (i, length) => (i !== length - 1 ? ',' : '');
const getJoiner = (i, length) => (i !== length - 2 ? getPunc(i, length) : ', and');

// pulls the top artists of user in the past period as an array of size limit
const getTopArtists = async (limit, period) => {
  const query = `{
    lastfm {
      mostPlayedArtists(limit: ${limit}, period: ${period}) {
        artist
        playcount
      }
    }
  }`;
  const response = await fetch('https://api.chriswb.dev', {
    method: 'POST',
    body: JSON.stringify({ query }),
  });
  const json = await response.json();
  return json && json.data && json.data.lastfm && json.data.lastfm.mostPlayedArtists;
};

const getUrlLength = async () => {
  try {
    const response = await twitter.get('help/configuration');
    if (!response.errors || response.errors.length > 0) {
      return response.short_url_length_https;
    }
    throw new Error(response);
  } catch (error) {
    console.error(error);
    return null;
  }
};

// sends a tweet comprised of 'text'
const sendTweet = text => twitter.post('statuses/update', { status: text });

// create a string of artists with playcounts
const createArtistString = topArtists =>
  topArtists.reduce(
    (accumulator, artist, i) =>
      `${accumulator} ${artist.artist} (${artist.playcount})${getJoiner(i, topArtists.length)}`,
    '',
  );

const setupTweet = async (artistArray, urlLength) => {
  const artistString = createArtistString(artistArray || []);
  if (!artistString) {
    throw new Error('No Artists!');
  }
  const tweetString = `Top artists this week:${artistString}

  (via `; // include the via because we need to count it

  if (tweetString.length + urlLength + 1 <= 280) {
    try {
      await sendTweet(`${tweetString}https://last.fm/user/${userName})`);
      console.info(`Successfully Tweeted!
       ${tweetString}https://last.fm/user/${userName})`);
      return `Successfully Tweeted!
       ${tweetString}https://last.fm/user/${userName})`;
    } catch (error) {
      console.warn(`Couldn't tweet ${tweetString}https://last.fm/user/${userName})`);
      console.warn(error, null, 2);
    }
  } else if (artistArray.length > 1) {
    console.info(
      `Too long ${tweetString}https://last.fm/user/${userName})

      Trying with ${artistArray.length - 1} artists`,
    );
    setupTweet(artistArray.splice(0, artistArray.length - 1), urlLength);
  } else {
    console.info(`The top artist, ${createArtistString(artistArray)}, has too long a name`);
  }
};

// gets last.fm artists and prepares them for tweeting
const main = async (name, numberArtists, period) => {
  try {
    const topArtists = await getTopArtists(numberArtists, period);
    const urlLength = await getUrlLength();
    return setupTweet(topArtists, urlLength);
  } catch (error) {
    console.error(error);
    return 'Failed to Tweet';
  }
};

module.exports.tweetMostPlayedArtists = async () => {
  return main(userName, initialArtistNumber, defaultTimePeriod);
};
