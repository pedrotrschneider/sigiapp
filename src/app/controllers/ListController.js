const List = require('../models/List')
const Committe = require('../models/Committe')
const User = require('../models/User')

class ListController {
  async getList (req, res) {
    const committe = await Committe.findById(req.params.id)

    if (committe.lists.length == 0) {
      return res.status(400).json({
        error: 'Session not initialized'
      })
    }

    const list = await List.findById(committe.lists[0]).populate('users')

    const delegations = list.users.map(async user => {
      const u = await User.findById(user._id).populate('delegation')

      if (committe.isEnglish) {
        const english = u.delegation.englishName || user.delegation.name
        u.delegation.name = english
      }

      return u
    })

    Promise.all(delegations).then(completed => {
      return res.json(completed)
    })
  }

  async next (req, res) {
    const committe = await Committe.findById(req.params.id)
    const list = await List.findById(committe.lists[0])

    if (list.users.length == 0) {
      return res.status(400).json({ error: 'The speakers list is empty' })
    }

    list.lastUser = list.users[0]
    list.users.shift()
    await list.save()

    const delegations = list.users.map(async user => {
      const u = await User.findById(user._id).populate('delegation')
      if (committe.isEnglish) {
        u.delegation.name = u.delegation.englishName || u.delegation.name
      }

      return u
    })

    Promise.all(delegations).then(completed => {
      req.io.sockets.in(committe._id).emit('list', completed)
    })

    return res.json(list)
  }

  async previous (req, res) {
    const committe = await Committe.findById(req.params.id)
    const list = await List.findById(committe.lists[0])

    if (list.lastUser == null) {
      return res.status(400).json({
        error: 'There is not a last delegation saved in database',
        id: 1
      })
    }

    if (list.users.includes(list.lastUser)) {
      return res.status(400).json({
        error: 'The last delegation is alerady in the speakers list',
        id: 0
      })
    }

    list.users.unshift(list.lastUser)
    list.lastUser = null

    await list.save()

    const delegations = list.users.map(async user => {
      const u = await User.findById(user._id).populate('delegation')
      if (committe.isEnglish) {
        u.delegation.name = u.delegation.englishName || u.delegation.name
      }

      return u
    })

    Promise.all(delegations).then(completed => {
      req.io.sockets.in(committe._id).emit('list', completed)
    })

    return res.json(list)
  }

  async push (req, res) {
    const committe = await Committe.findById(req.params.id)
    const user = await User.findById(req.params.user_id)

    if (user.committe.toString() != committe._id.toString()) {
      return res
        .status(400)
        .json({ error: 'You do not belong to this committe' })
    }

    if (user.present == 0) {
      return res.status(400).json({
        error:
          'Você consta como ausente no comitê. Caso esteja presente, por favor peça uma moção de reconhecimento à mesa de diretores. Obrigado!',
        id: 0
      })
    }

    const list = await List.findById(committe.lists[0])

    if (list.users.includes(user._id)) {
      return res.status(400).json({
        error:
          'Você já está na lista de oradores. Caso não apareça para você, por favor reinicie a página. Obrigado!',
        id: 2
      })
    }

    list.users.push(user)

    await list.save()

    const delegations = list.users.map(async user => {
      const u = await User.findById(user._id).populate('delegation')
      if (committe.isEnglish) {
        u.delegation.name = u.delegation.englishName || u.delegation.name
      }

      return u
    })

    Promise.all(delegations).then(completed => {
      req.io.sockets.in(committe._id).emit('list', completed)
    })

    return res.json(list)
  }
}

module.exports = new ListController()
