import logger from '@overleaf/logger'
import AuthenticationController from '../../../../app/src/Features/Authentication/AuthenticationController.mjs'
import OAuthPersonalAccessTokenController from './OAuthPersonalAccessTokenController.js'
import TokenController from './TokenController.js'

export default {
  apply(webRouter) {
    logger.debug({}, 'Oauth2Server router')
    
    // Health check endpoint
    webRouter.get('/ayaka/oauth2-server', (req, res) => {
      res.json({ message: 'Dev by ayaka-notes' })
    })

    // Token verification and information endpoints
    webRouter.get('/oauth/token/info', TokenController.checkOAuthToken)
    webRouter.get('/oauth/token/details', TokenController.getTokenInfo)
    webRouter.post('/oauth/token/validate', TokenController.validateToken)

    // Personal access token management endpoints
    webRouter.get(
      '/oauth/personal-access-tokens',
      AuthenticationController.requireLogin(),
      OAuthPersonalAccessTokenController.getUserPersonalAccessTokens
    )

    webRouter.post(
      '/oauth/personal-access-tokens',
      AuthenticationController.requireLogin(),
      OAuthPersonalAccessTokenController.createPersonalAccessToken
    )

    webRouter.delete(
      '/oauth/personal-access-tokens/:token_id',
      AuthenticationController.requireLogin(),
      OAuthPersonalAccessTokenController.deletePersonalAccessToken
    )
  },
}
