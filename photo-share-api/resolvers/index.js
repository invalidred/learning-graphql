const { GraphQLScalarType } = require("graphql");
const { authorizeWithGithub } = require('../lib')
let id = 0;
var users = [
  { githubLogin: "mHattrup", name: "Mike Hattrup" },
  { githubLogin: "gPlake", name: "Glen Plake" },
  { githubLogin: "sSchmidt", name: "Scot Schmidt" }
];

var photos = [
  {
    id: "1",
    name: "Dropping the Heart Chute",
    description: "The heart chute is one of my favorite chutes",
    category: "ACTION",
    githubUser: "gPlake",
    created: "3-28-1977"
  },
  {
    id: "2",
    name: "Enjoying the sunshine",
    category: "SELFIE",
    githubUser: "sSchmidt",
    created: "1-2-1985"
  },
  {
    id: "3",
    name: "Gunbarrel 25",
    description: "25 laps on gunbarrel today",
    category: "LANDSCAPE",
    githubUser: "sSchmidt",
    created: "2018-04-15T19:09:57.308Z"
  }
];

var tags = [
  { photoID: "1", userID: "gPlake" },
  { photoID: "2", userID: "sSchmidt" },
  { photoID: "2", userID: "mHattrup" },
  { photoID: "2", userID: "gPlake" }
];

const resolvers = {
  Query: {
    me: (parent, args, { currentUser }) => currentUser,
    totalPhotos: (parent, args, { db }) =>
      db.collection("photos").estimatedDocumentCount(),
    allPhotos: (parent, args, { db }) =>
      db
        .collection("photos")
        .find()
        .toArray(),
    totalUsers: (parent, args, { db }) =>
      db.collection("users").estimatedDocumentCount(),
    allUsers: (parent, args, { db }) =>
      db
        .collection("users")
        .find()
        .toArray(),
  },
  Mutation: {
    postPhoto: (_parent, args) => {
      photos.push({
        id: id++,
        ...args.input,
        created: new Date()
      });
      return photos[id - 1];
    },
    githubAuth: async (parent, { code }, { db }) => {
      let {
        message, access_token, avatar_url,
        login, name
      } = await authorizeWithGithub({
        client_id: '922978be022acfa93b51',
        client_secret: 'deebbe96297bd23d8f4396f948ab945003cbf625',
        code
      })
      if (message) {
        throw new Error(message)
      }
      let latestUserInfo = {
        name,
        githubLogin: login,
        githubToken: access_token,
        avatar: avatar_url
      }
      const { ops: [user] } = await db
        .collection('users')
        .replaceOne(
          { githubLogin: login },
          latestUserInfo,
          { upsert: true }
        )
      return { user, token: access_token }
    },
    postPhoto: async (parent, args, { db, currentUser }) => {
      console.log('postPhoto:parent->', parent)
      if (!currentUser) {
        throw new Error('only an authorized user can post a photo')
      }
      const newPhoto = {
        ...args.input,
        userID: currentUser.githubLogin,
        created: new Date()
      }
      const { insertedIds } = await db.collection('photos').insert(newPhoto)
      newPhoto.id = insertedIds[0]

      return newPhoto
    },
    addFakeUsers: async (root, { count }, { db }) => {
      const randomUserApi = `https://randomuser.me/api/?results=${count}`
      const { results } = await fetch(randomUserApi)
        .then(res => res.json())

      const users = results.map(r => ({
        githubLogin: r.login.username,
        name: `${r.name.first} ${r.name.last}`,
        avatar: r.picture.thumbnail,
        githubToken: r.login.sha1
      }))

      await db.collection('users').insert(users)

      return users
    }
  },
  Photo: {
    id: parent => parent.id || parent._id,
    url: parent => `http://yoursite.com/img/${parent.id}.jpg`,
    postedBy: (parent, args, { db }) => {
      console.log('Photo:parent->', parent)
      return db.collection('users').findOne({ githubLogin: parent.userID })
    },
    taggedUsers: parent =>
      tags
        .filter(tag => tag.photoID === parent.id)
        .map(tag => tag.userID)
        .map(userID => users.find(u => u.githubLogin === userID))
  },
  User: {
    postedPhotos: parent => {
      return photos.filter(p => p.githubUser === parent.githubLogin);
    },
    inPhotos: parent =>
      tags
        .filter(tag => tag.photoID === parent.id)
        .map(tag => tag.photoID)
        .map(photoID => photos.find(p => p.id === photoID))
  },
  DateTime: new GraphQLScalarType({
    name: "DateTime",
    description: "A valid date time value",
    parseValue: value => new Date(value),
    serialize: value => new Date(value).toISOString(),
    parseLiteral: ast => ast.value
  })
};

module.exports = resolvers;
