import React, { useState, useEffect, useRef } from "react";
import "../css/Messages.css";
import Draggable from "react-draggable";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";

export default function MessagesUser({ response }) {
  const navigate = useNavigate();
  const [initialY, setInitialY] = useState(0);
  const { id } = useParams();
  const [messages, setMessages] = useState([]);
  const messageInputRef = useRef(null);
  const messageContainerRef = useRef(null);
  const UsrID = response?.id;
  const ws = useRef(null);
  const [info, setInfo] = useState(null);

  const handleDragStart = (_, { y }) => {
    setInitialY(y);
  };

  const handleDrag = (_, { y }) => {
    if (y < initialY) {
      navigate("/");
    } else {
      setInitialY(y);
    }
  };

  const fetchUserInfo = async () => {
    try {
      const response = await axios.get(`http://localhost:8001/user/${id}`);
      const name = response.data[0].name;
      const surname = response.data[0].surname;
      const img = response.data[0].img;
      setInfo({ name, surname, img });
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchUserInfo();
  }, []);

  const fetchMessages = async () => {
    try {
      const response = await axios.get(
        `http://localhost:8001/messages?sender_id=${UsrID}&recipient_id=${id}`
      );
      setMessages(response.data);
    } catch (error) {
      console.error(error);
    }
  };


  const formatTimestamp = (timestamp, index) => {
    const currentDate = new Date();
    const messageDate = new Date(timestamp);
    const timezoneOffset = messageDate.getTimezoneOffset() * 60 * 1000;
    const adjustedMessageDate = new Date(messageDate.getTime() - timezoneOffset);
  
    const optionsToday = {
      hour: "numeric",
      minute: "numeric",
    };
  
    const optionsWeek = {
      weekday: "long",
      hour: "numeric",
      minute: "numeric",
    };
  
    const optionsPastWeek = {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    };
  
    if (
      adjustedMessageDate.getDate() === currentDate.getDate() &&
      adjustedMessageDate.getMonth() === currentDate.getMonth() &&
      adjustedMessageDate.getFullYear() === currentDate.getFullYear()
    ) {
      if (
        index === 0 ||
        adjustedMessageDate.getMinutes() !==
          new Date(messages[index - 1].timestamp).getMinutes()
      ) {
        return adjustedMessageDate.toLocaleTimeString([], optionsToday);
      }
    } else if (
      adjustedMessageDate.getTime() >=
      currentDate.getTime() - 7 * 24 * 60 * 60 * 1000
    ) {
      if (
        index === 0 ||
        adjustedMessageDate.getMinutes() !==
          new Date(messages[index - 1].timestamp).getMinutes()
      ) {
        return adjustedMessageDate.toLocaleTimeString([], optionsWeek);
      }
    } else {
      return adjustedMessageDate.toLocaleString("en-US", optionsPastWeek);
    }
  };

  const sendMessage = async () => {
    const messageContent = messageInputRef.current.value;
    if (messageContent) {
      try {
        await axios.post("http://localhost:8001/messages", {
          sender_id: UsrID,
          recipient_id: id,
          message_content: messageContent,
          timestamp: new Date().toISOString(),
        });
        messageInputRef.current.value = "";
        await fetchMessages();
        scrollToBottom();
      } catch (error) {
        console.error(error);
      }
    }
  };

  const scrollToBottom = () => {
    const container = messageContainerRef.current;
    container.scrollTop = container.scrollHeight;
  };

  useEffect(() => {
    fetchMessages();

    ws.current = new WebSocket('ws://localhost:8001');

    ws.current.onmessage = (event) => {
      const newMessage = JSON.parse(event.data);
      setMessages((prevMessages) => [...prevMessages, newMessage]);
      scrollToBottom();
    };

    // return () => {
    //   if (ws.current && ws.current.readyState === WebSocket.OPEN) {
    //     ws.current.close();
    //   }
    // };
  }, [id, UsrID]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="AppScreen Messages">
      <div className="holderOfNamesAndImg">
        {info?.img !== null && info?.img !== "" ? (
          <img
            src={`http://localhost:8001/uploads/${info?.img}`}
            className="userImage MEssagesApp"
            alt="User"
          />
        ) : (
          <div className="userImage noImg MEssagesApp" alt="User">
            {(info?.name)?.slice(0, 1)}
          </div>
        )}
        <span>
          {info?.name} {info?.surname}
        </span>
      </div>
      <div className="MessagesWrapper">
        <div className="message-container" ref={messageContainerRef}>
          {messages.map((message, index) => (
            <div
              key={message.message_id}
              className={`message ${
                message.sender_id === UsrID ? "Sender" : "Receiver"
              }`}
            >
              <p>{formatTimestamp(message.timestamp, index)}</p>
              <span>{message.message_content}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="message-input">
        <div className="inputHoldixonre">
          <input type="text" ref={messageInputRef} placeholder="iMessage" />
          <button onClick={sendMessage}>^</button>
        </div>
      </div>

      <Draggable
        axis="y"
        position={{ x: 0, y: 0 }}
        onStart={handleDragStart}
        onDrag={handleDrag}
      >
        <div className="backBar calculator"></div>
      </Draggable>
    </div>
  );
}
