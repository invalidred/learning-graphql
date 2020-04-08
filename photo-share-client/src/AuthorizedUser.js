import React, { Component } from 'react'
import { withRouter } from 'react-router-dom'
import { Mutation, Query, withApollo } from 'react-apollo'
import { gql } from 'apollo-boost'
import { ROOT_QUERY } from './App'

const GITHUB_AUTH_MUTATION = gql`
    mutation githubAuth($code:String!) {
        githubAuth(code: $code) { token }
    }
`

class AuthorizedUser extends Component {
    state = { signingIn: false }

    authorizationComplete = (cache, { data }) => {
        localStorage.setItem('token', data.githubAuth.token)
        this.props.history.replace('/')
        this.setState({ signingIn: false })
    }
    componentDidMount() {
        if (window.location.search.match(/code=/)) {
            this.setState({ signingIn: true })
            const code = window.location.search.replace("?code=", "")
            this.gethubAuthMutation({ variables: { code } })
        }
    }

    requestCode() {
        const clientID = '922978be022acfa93b51'
        window.location =
            `https://github.com/login/oauth/authorize?client_id=${clientID}&scope=user`
    }

    render() {
        return (
            <Mutation mutation={GITHUB_AUTH_MUTATION}
                update={this.authorizationComplete}
                refetchQueries={[{ query: ROOT_QUERY }]}>
                {mutation => {
                    this.gethubAuthMutation = mutation
                    return (
                        <Me signingIn={this.state.signingIn}
                            requestCode={this.requestCode}
                            logout={() => {
                                localStorage.removeItem('token')
                                let data = this.props.client.readQuery({ query: ROOT_QUERY })
                                const updatedData = {
                                    ...data,
                                    me: null
                                }
                                this.props.client.writeQuery({ query: ROOT_QUERY, data: updatedData })
                                debugger
                            }}
                        />
                    )
                }}
            </Mutation>
        )
    }
}

const Me = ({ logout, requestCode, signingIn }) =>
    <Query query={ROOT_QUERY}>
        {({ loading, data }) => {
            debugger
            return data && data.me ?
                <CurrentUser {...data.me} logout={logout} /> :
                loading ?
                    <p>loading...</p> :
                    <button
                        onClick={requestCode}
                        disabled={signingIn}>
                        Sign In with Github
                </button>
        }}
    </Query>

const CurrentUser = ({ name, avatar, logout }) =>
    <div>
        <img src={avatar} width={48} height={48} alt="" />
        <h1>{name}</h1>
        <button onClick={logout}>logout</button>
    </div>

export default withApollo(withRouter(AuthorizedUser))

/*
    curl -X POST \
        -H "Content-Type: application/json" \
        --data '{ "query": "{totalUsers, totalPhotos}"'
        http://localhost:4000/graphql
*/