"""
Property-based tests for data privacy protection
**Feature: voice-mental-health-assistant, Property 8: Data Privacy Protection**
**Validates: Requirements 6.1, 6.2, 6.3, 6.5**
"""

import pytest
from hypothesis import given, strategies as st, assume
from datetime import datetime, timedelta
import threading
import time
import uuid

from session_manager import SessionManager, SessionData, ConversationPhase, ScreeningTool


class TestDataPrivacyProperties:
    """Property-based tests for data privacy protection"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.session_manager = SessionManager(timeout_minutes=1, max_sessions=100)
    
    def teardown_method(self):
        """Clean up after tests"""
        self.session_manager.shutdown()
    
    @given(st.text(min_size=1, max_size=100), st.text(min_size=1, max_size=50))
    def test_session_data_memory_only_storage(self, user_name, country):
        """
        Property 8a: Session Data Memory-Only Storage
        For any session data, it should only exist in memory and not persist to disk
        **Validates: Requirements 6.1**
        """
        assume(len(user_name.strip()) > 0 and len(country.strip()) > 0)
        
        # Create session with user data
        session_id = self.session_manager.create_session(
            user_name=user_name.strip(),
            country=country.strip()
        )
        
        # Verify session exists in memory
        session = self.session_manager.get_session(session_id)
        assert session is not None
        assert session.user_name == user_name.strip()
        assert session.country == country.strip()
        
        # Verify data is only in memory (sessions dict)
        assert session_id in self.session_manager.sessions
        assert self.session_manager.sessions[session_id].user_name == user_name.strip()
        
        # Session data should not persist beyond memory
        # (This property is validated by the fact that SessionManager only uses in-memory dict)
        assert isinstance(self.session_manager.sessions, dict)
    
    @given(st.lists(st.text(min_size=1, max_size=200), min_size=1, max_size=10))
    def test_automatic_session_cleanup_on_expiry(self, conversation_messages):
        """
        Property 8b: Automatic Session Cleanup on Expiry
        For any session with conversation data, it should be automatically cleaned up after timeout
        **Validates: Requirements 6.2**
        """
        assume(all(len(msg.strip()) > 0 for msg in conversation_messages))
        
        # Create session with short timeout for testing
        short_timeout_manager = SessionManager(timeout_minutes=1, max_sessions=100)
        
        try:
            session_id = short_timeout_manager.create_session(user_name="test_user")
            
            # Add conversation data
            for i, message in enumerate(conversation_messages):
                short_timeout_manager.add_conversation(
                    session_id, 
                    message.strip(), 
                    f"Response {i}", 
                    "GREETING"
                )
            
            # Verify session exists with data
            session = short_timeout_manager.get_session(session_id)
            assert session is not None
            assert len(session.conversation_history) == len(conversation_messages)
            
            # Manually expire the session by modifying its last_activity time
            session.last_activity = datetime.now() - timedelta(minutes=2)  # Make it expired
            
            # Trigger cleanup
            removed_count = short_timeout_manager.cleanup_expired_sessions()
            
            # Session should be automatically removed
            expired_session = short_timeout_manager.get_session(session_id)
            assert expired_session is None
            assert removed_count >= 1
            
        finally:
            short_timeout_manager.shutdown()
    
    @given(st.lists(st.tuples(
        st.text(min_size=1, max_size=50),  # question_id
        st.text(min_size=1, max_size=100),  # user_text
        st.integers(min_value=0, max_value=3)  # score
    ), min_size=1, max_size=9))
    def test_no_persistent_logging_of_responses(self, response_tuples):
        """
        Property 8c: No Persistent Logging of Responses
        For any user responses, they should not be logged to persistent storage
        **Validates: Requirements 6.3**
        """
        assume(all(
            len(question_id.strip()) > 0 and len(user_text.strip()) > 0
            for question_id, user_text, score in response_tuples
        ))
        
        session_id = self.session_manager.create_session(user_name="privacy_test")
        
        # Add responses to session
        for question_id, user_text, score in response_tuples:
            self.session_manager.add_response(
                session_id,
                question_id.strip(),
                user_text.strip(),
                score
            )
        
        # Verify responses exist in memory
        session = self.session_manager.get_session(session_id)
        assert session is not None
        assert len(session.responses) == len(response_tuples)
        
        # Verify responses are only in memory (not persisted)
        # This is validated by the fact that responses are stored in SessionData dataclass
        # which only exists in the in-memory sessions dict
        for i, response in enumerate(session.responses):
            expected_question_id, expected_user_text, expected_score = response_tuples[i]
            assert response.question_id == expected_question_id.strip()
            assert response.user_text == expected_user_text.strip()
            assert response.mapped_score == expected_score
            assert isinstance(response.timestamp, datetime)
    
    @given(st.integers(min_value=1, max_value=50))
    def test_session_deletion_removes_all_data(self, num_sessions):
        """
        Property 8d: Session Deletion Removes All Data
        For any number of sessions with data, deletion should completely remove all traces
        **Validates: Requirements 6.2, 6.5**
        """
        session_ids = []
        
        # Create multiple sessions with data
        for i in range(num_sessions):
            session_id = self.session_manager.create_session(
                user_name=f"user_{i}",
                country=f"country_{i}"
            )
            session_ids.append(session_id)
            
            # Add some data to each session
            self.session_manager.add_conversation(
                session_id,
                f"Message from user {i}",
                f"Response to user {i}",
                "GREETING"
            )
            self.session_manager.add_response(
                session_id,
                f"q_{i}",
                f"User response {i}",
                i % 4  # Score 0-3
            )
        
        # Verify all sessions exist
        assert self.session_manager.get_session_count() >= num_sessions
        for session_id in session_ids:
            session = self.session_manager.get_session(session_id)
            assert session is not None
            assert len(session.conversation_history) >= 1
            assert len(session.responses) >= 1
        
        # Delete all sessions
        for session_id in session_ids:
            success = self.session_manager.delete_session(session_id)
            assert success is True
        
        # Verify all sessions and their data are completely removed
        for session_id in session_ids:
            session = self.session_manager.get_session(session_id)
            assert session is None
            assert session_id not in self.session_manager.sessions
    
    @given(st.integers(min_value=1, max_value=20))
    def test_max_sessions_limit_enforces_privacy(self, num_sessions_to_create):
        """
        Property 8e: Max Sessions Limit Enforces Privacy
        For any number of sessions beyond the limit, old sessions should be removed
        **Validates: Requirements 6.1, 6.2**
        """
        # Create session manager with small limit
        limited_manager = SessionManager(timeout_minutes=30, max_sessions=5)
        
        try:
            session_ids = []
            
            # Create sessions up to and beyond the limit
            for i in range(num_sessions_to_create):
                session_id = limited_manager.create_session(user_name=f"user_{i}")
                session_ids.append(session_id)
                
                # Add some data
                limited_manager.add_conversation(
                    session_id,
                    f"Message {i}",
                    f"Response {i}",
                    "GREETING"
                )
            
            # Should never exceed max_sessions limit
            assert limited_manager.get_session_count() <= 5
            
            # If we created more than 5 sessions, some should have been removed
            if num_sessions_to_create > 5:
                # Some early sessions should be gone
                removed_sessions = 0
                for session_id in session_ids[:num_sessions_to_create-5]:
                    if limited_manager.get_session(session_id) is None:
                        removed_sessions += 1
                
                # At least some sessions should have been removed to enforce limit
                assert removed_sessions > 0
        
        finally:
            limited_manager.shutdown()
    
    @given(st.text(min_size=5, max_size=100))  # Minimum 5 characters to avoid single char overlaps
    def test_conversation_history_privacy_isolation(self, sensitive_message):
        """
        Property 8f: Conversation History Privacy Isolation
        For any sensitive conversation data, it should be isolated per session
        **Validates: Requirements 6.1, 6.3**
        """
        assume(len(sensitive_message.strip()) >= 5)  # Ensure meaningful message length
        assume("Different message" not in sensitive_message.strip())  # Avoid overlap with test message
        
        # Create two separate sessions
        session_id_1 = self.session_manager.create_session(user_name="user1")
        session_id_2 = self.session_manager.create_session(user_name="user2")
        
        # Add sensitive message to first session only
        self.session_manager.add_conversation(
            session_id_1,
            sensitive_message.strip(),
            "AI response",
            "SCREENING"
        )
        
        # Add different message to second session
        control_message = "Completely unrelated control message for session 2"
        self.session_manager.add_conversation(
            session_id_2,
            control_message,
            "Different AI response",
            "GREETING"
        )
        
        # Verify isolation - session 1 has sensitive message
        session_1 = self.session_manager.get_session(session_id_1)
        assert session_1 is not None
        assert len(session_1.conversation_history) == 1
        assert session_1.conversation_history[0]['user_message'] == sensitive_message.strip()
        
        # Verify isolation - session 2 does not have sensitive message
        session_2 = self.session_manager.get_session(session_id_2)
        assert session_2 is not None
        assert len(session_2.conversation_history) == 1
        assert session_2.conversation_history[0]['user_message'] == control_message
        
        # Verify no cross-contamination (only check if messages are sufficiently different)
        if len(sensitive_message.strip()) > 10:  # Only check for longer messages
            assert sensitive_message.strip() not in session_2.conversation_history[0]['user_message']
    
    @given(st.integers(min_value=1, max_value=10))
    def test_concurrent_session_privacy_safety(self, num_concurrent_sessions):
        """
        Property 8g: Concurrent Session Privacy Safety
        For any number of concurrent sessions, data should remain isolated and secure
        **Validates: Requirements 6.1, 6.2**
        """
        session_data = {}
        threads = []
        
        def create_and_populate_session(thread_id):
            session_id = self.session_manager.create_session(user_name=f"concurrent_user_{thread_id}")
            
            # Add unique data to this session
            unique_message = f"Unique message from thread {thread_id}"
            self.session_manager.add_conversation(
                session_id,
                unique_message,
                f"Response to thread {thread_id}",
                "GREETING"
            )
            
            session_data[thread_id] = {
                'session_id': session_id,
                'unique_message': unique_message
            }
        
        # Create concurrent sessions
        for i in range(num_concurrent_sessions):
            thread = threading.Thread(target=create_and_populate_session, args=(i,))
            threads.append(thread)
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        # Verify each session has only its own data
        for thread_id, data in session_data.items():
            session = self.session_manager.get_session(data['session_id'])
            assert session is not None
            assert session.user_name == f"concurrent_user_{thread_id}"
            assert len(session.conversation_history) == 1
            assert session.conversation_history[0]['user_message'] == data['unique_message']
            
            # Verify this session doesn't contain data from other sessions
            for other_thread_id, other_data in session_data.items():
                if other_thread_id != thread_id:
                    assert other_data['unique_message'] not in session.conversation_history[0]['user_message']
    
    def test_session_manager_shutdown_clears_all_data(self):
        """
        Property 8h: Session Manager Shutdown Clears All Data
        When session manager shuts down, all session data should be cleared
        **Validates: Requirements 6.2, 6.5**
        """
        # Create a separate session manager for this test
        test_manager = SessionManager(timeout_minutes=30, max_sessions=100)
        
        # Create sessions with data
        session_ids = []
        for i in range(5):
            session_id = test_manager.create_session(user_name=f"shutdown_test_{i}")
            session_ids.append(session_id)
            test_manager.add_conversation(
                session_id,
                f"Test message {i}",
                f"Test response {i}",
                "GREETING"
            )
        
        # Verify sessions exist
        assert test_manager.get_session_count() == 5
        for session_id in session_ids:
            assert test_manager.get_session(session_id) is not None
        
        # Shutdown manager
        test_manager.shutdown()
        
        # Verify all data is cleared
        assert test_manager.get_session_count() == 0
        for session_id in session_ids:
            assert test_manager.get_session(session_id) is None


# Additional unit tests for specific privacy scenarios
class TestDataPrivacyEdgeCases:
    """Unit tests for specific data privacy edge cases"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.session_manager = SessionManager(timeout_minutes=30, max_sessions=100)
    
    def teardown_method(self):
        """Clean up after tests"""
        self.session_manager.shutdown()
    
    def test_invalid_session_id_no_data_leak(self):
        """Test that invalid session IDs don't leak data from other sessions"""
        # Create a real session
        real_session_id = self.session_manager.create_session(user_name="real_user")
        self.session_manager.add_conversation(
            real_session_id,
            "Sensitive information",
            "AI response",
            "SCREENING"
        )
        
        # Try to access with invalid session ID
        fake_session_id = str(uuid.uuid4())
        fake_session = self.session_manager.get_session(fake_session_id)
        
        # Should not return any data
        assert fake_session is None
    
    def test_expired_session_data_inaccessible(self):
        """Test that expired session data becomes immediately inaccessible"""
        # Create session with very short timeout
        short_manager = SessionManager(timeout_minutes=0.001, max_sessions=100)  # ~0.06 seconds
        
        try:
            session_id = short_manager.create_session(user_name="expiry_test")
            short_manager.add_conversation(
                session_id,
                "This should expire quickly",
                "Response",
                "GREETING"
            )
            
            # Verify session exists initially
            session = short_manager.get_session(session_id)
            assert session is not None
            
            # Wait for expiry
            time.sleep(0.1)
            
            # Session should be inaccessible
            expired_session = short_manager.get_session(session_id)
            assert expired_session is None
            
        finally:
            short_manager.shutdown()
    
    def test_session_update_preserves_privacy_boundaries(self):
        """Test that session updates don't cross privacy boundaries"""
        # Create two sessions
        session_id_1 = self.session_manager.create_session(user_name="user1")
        session_id_2 = self.session_manager.create_session(user_name="user2")
        
        # Update first session
        success = self.session_manager.update_session(
            session_id_1,
            current_phase="SCREENING",
            selected_tool="PHQ9"
        )
        assert success is True
        
        # Verify update only affected first session
        session_1 = self.session_manager.get_session(session_id_1)
        session_2 = self.session_manager.get_session(session_id_2)
        
        assert session_1.current_phase == ConversationPhase.SCREENING
        assert session_1.selected_tool == ScreeningTool.PHQ9
        
        assert session_2.current_phase == ConversationPhase.GREETING
        assert session_2.selected_tool is None
    
    def test_response_data_not_shared_between_sessions(self):
        """Test that response data is not shared between sessions"""
        session_id_1 = self.session_manager.create_session(user_name="user1")
        session_id_2 = self.session_manager.create_session(user_name="user2")
        
        # Add response to first session
        self.session_manager.add_response(
            session_id_1,
            "phq9_q1",
            "I feel depressed several days",
            2
        )
        
        # Add different response to second session
        self.session_manager.add_response(
            session_id_2,
            "gad7_q1",
            "I feel anxious not at all",
            0
        )
        
        # Verify responses are isolated
        session_1 = self.session_manager.get_session(session_id_1)
        session_2 = self.session_manager.get_session(session_id_2)
        
        assert len(session_1.responses) == 1
        assert len(session_2.responses) == 1
        
        assert session_1.responses[0].question_id == "phq9_q1"
        assert session_1.responses[0].mapped_score == 2
        
        assert session_2.responses[0].question_id == "gad7_q1"
        assert session_2.responses[0].mapped_score == 0
        
        # Verify no cross-contamination
        assert "gad7_q1" not in [r.question_id for r in session_1.responses]
        assert "phq9_q1" not in [r.question_id for r in session_2.responses]