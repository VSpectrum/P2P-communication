// Set up a WebSocket connection to the FastAPI server
const room = window.location.hash ? window.location.hash.substr(1) : null;
const sig_server = 'signal.reticence.net:8000';
const sig_server_socket = new WebSocket(`wss://${sig_server}/chat/${room}`);
const chan_channel = 'chat';
let connectionChangeCount = 0;

// Set up a WebRTC peer connection
const baseConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const peerConnections = {}; // {connection: RTCPeerConnection(baseConfig)};
const dataChannels = {}; // {connection: dataChannel}  // these are not part of the RTCPeerConnection object

sig_server_socket.onopen = () => {
    console.log('Connected to signaling server');
};

sig_server_socket.onclose = () => {
    console.log('Lost connection to signaling server');
};

const openDataChannel = (connection) => {
    var dataChannelOptions = {
        reliable: true
    };
    dataChannels[connection] = connection.createDataChannel(chan_channel, dataChannelOptions);
    dataChannels[connection].onopen = function () {
        console.log('Text channel ready');
    };
}

const buildHTMLMessage = (event, sent = false) => {
    const currentTime = new Date();
    const time = currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true });
    return `<div class="message ${sent ? 'sent' : ''}">
        <div class="sender-name"></div>
        <div class="message-text">${event.data}</div>
        <div class="message-time ${sent ? "flex-end" : ''}">${time}</div>
    </div>`;
}

const messageReceived = (event) => {
    console.log('event', event);
    if (event.data) {
        document.getElementById('chat-body').innerHTML += buildHTMLMessage(event);
        document.getElementById('chat-body').scrollTop = document.getElementById('chat-body').scrollHeight;
    }
}

document.getElementById("chatInputText").addEventListener("keydown", (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById("chatInputButton").click();
    }
});

document.getElementById("chatInputButton").addEventListener("click", () => {
    const chatInput = document.getElementById("chatInputText");
    const inputText = chatInput.textContent;
    if (inputText === "") return;
    for (const channel of Object.keys(dataChannels)) {
        dataChannels[channel].send(inputText);
        document.getElementById('chat-body').innerHTML += buildHTMLMessage({ data: inputText }, true);
        document.getElementById('chat-body').scrollTop = document.getElementById('chat-body').scrollHeight;
    }
    chatInput.textContent = "";
});

// Listen for incoming WebRTC ICE candidates from the server
sig_server_socket.addEventListener('message', event => {
    const data = JSON.parse(event.data);
    console.log(data);
    if (data.connections) {
        if (connectionChangeCount > 0) {
            for (const connection of data.connections) {
                if (!Object.keys(peerConnections).includes(connection)) {
                    // setup peer connection + offer and send it to the new connection
                    peerConnections[connection] = new RTCPeerConnection(baseConfig);
                    openDataChannel(peerConnections[connection]);
                    peerConnections[connection].ondatachannel = (event) => {
                        const dataChannel = event.channel;
                        dataChannel.onmessage = (event) => {
                            if (event.target.label === chan_channel) {
                                messageReceived(event);
                            }
                        };
                    };
                    const chatChannel = peerConnections[connection].createDataChannel('chat');
                    peerConnections[connection].createOffer().then((offer) => {
                        peerConnections[connection].onicecandidate = ({ candidate }) => {
                            if (candidate) {
                                peerConnections[connection].addIceCandidate(candidate);
                                sig_server_socket.send(JSON.stringify({ transaction: 'ice', payload: JSON.stringify(candidate), to: connection }));
                            }
                        }
                        peerConnections[connection].setLocalDescription(offer);
                        sig_server_socket.send(JSON.stringify({ transaction: 'offer', payload: JSON.stringify(offer), to: connection }));
                    });
                }
            }
        }
        else {
            connectionChangeCount++;
        }
    }
    if (data.from) {
        if (data.transaction === 'offer') {
            peerConnections[data.from] = new RTCPeerConnection(baseConfig);
            openDataChannel(peerConnections[data.from]);
            peerConnections[data.from].ondatachannel = (event) => {
                const dataChannel = event.channel;
                dataChannel.onmessage = (event) => {
                    if (event.target.label === chan_channel) {
                        messageReceived(event);
                    }
                };
            };
            peerConnections[data.from].createDataChannel('chat');
            peerConnections[data.from].setRemoteDescription(JSON.parse(data.payload));
            peerConnections[data.from].createAnswer().then((answer) => {
                peerConnections[data.from].onicecandidate = ({ candidate }) => {
                    if (candidate) {
                        peerConnections[data.from].addIceCandidate(candidate);
                        sig_server_socket.send(JSON.stringify({ transaction: 'ice', payload: JSON.stringify(candidate), to: data.from }));
                    }
                }
                peerConnections[data.from].setLocalDescription(answer);
                sig_server_socket.send(JSON.stringify({ transaction: 'answer', payload: JSON.stringify(answer), to: data.from }));
            });
        }
        if (data.transaction === 'answer') {
            peerConnections[data.from].setRemoteDescription(JSON.parse(data.payload));
        }
        if (data.transaction === 'ice' && data.payload) {
            peerConnections[data.from].addIceCandidate(JSON.parse(data.payload));
        }
    }
});