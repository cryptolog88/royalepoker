import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client/core';
import { ApolloProvider } from '@apollo/client/react';

const ARENA_CHAIN_ID = import.meta.env.VITE_ARENA_CHAIN_ID;
const ARENA_APP_ID = import.meta.env.VITE_ARENA_APP_ID;

// Use VITE_LINERA_SERVICE_URL if set, otherwise use relative URL for Vite proxy
const SERVICE_URL = import.meta.env.VITE_LINERA_SERVICE_URL || '';

const ARENA_GRAPHQL_URL = `${SERVICE_URL}/chains/${ARENA_CHAIN_ID}/applications/${ARENA_APP_ID}`;

console.log('[Arena] GraphQL URL:', ARENA_GRAPHQL_URL);

// Create Apollo Client for Arena queries
const arenaHttpLink = new HttpLink({
    uri: ARENA_GRAPHQL_URL,
});

export const arenaClient = new ApolloClient({
    link: arenaHttpLink,
    cache: new InMemoryCache(),
    defaultOptions: {
        watchQuery: {
            fetchPolicy: 'network-only',
        },
        query: {
            fetchPolicy: 'network-only',
        },
    },
});

interface ArenaGraphQLProviderProps {
    children: React.ReactNode;
}

export const ArenaGraphQLProvider: React.FC<ArenaGraphQLProviderProps> = ({ children }) => {
    return <ApolloProvider client={arenaClient}>{children}</ApolloProvider>;
};
