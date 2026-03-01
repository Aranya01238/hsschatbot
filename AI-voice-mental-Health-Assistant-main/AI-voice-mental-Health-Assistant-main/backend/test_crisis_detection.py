"""
Property-based tests for crisis detection and safety layer
**Feature: voice-mental-health-assistant, Property 3: Crisis Detection and Response**
**Validates: Requirements 3.1, 3.3, 3.4, 3.5**
"""

import pytest
from hypothesis import given, strategies as st, assume
from safety_monitor import SafetyMonitor, CrisisOverrideHandler, CrisisLevel
from datetime import datetime


class TestCrisisDetectionProperties:
    """Property-based tests for crisis detection system"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.safety_monitor = SafetyMonitor()
        self.crisis_handler = CrisisOverrideHandler(self.safety_monitor)
    
    @given(st.text(min_size=1, max_size=1000))
    def test_crisis_detection_consistency(self, text):
        """
        Property 3a: Crisis Detection Consistency
        For any text input, crisis detection should be deterministic and consistent
        **Validates: Requirements 3.1**
        """
        assume(len(text.strip()) > 0)  # Assume non-empty text
        
        # Run crisis detection multiple times on same input
        result1 = self.safety_monitor.check_for_crisis(text)
        result2 = self.safety_monitor.check_for_crisis(text)
        result3 = self.safety_monitor.check_for_crisis(text)
        
        # Results should be identical
        assert result1.level == result2.level == result3.level
        assert result1.triggered_words == result2.triggered_words == result3.triggered_words
        assert result1.requires_override == result2.requires_override == result3.requires_override
    
    @given(st.text(min_size=1, max_size=500))
    def test_crisis_override_requirement(self, text):
        """
        Property 3b: Crisis Override Requirement
        For any text that triggers CRITICAL level, override must be required
        **Validates: Requirements 3.3, 3.4**
        """
        assume(len(text.strip()) > 0)
        
        result = self.safety_monitor.check_for_crisis(text)
        
        # If crisis level is CRITICAL, override must be required
        if result.level == CrisisLevel.CRITICAL:
            assert result.requires_override is True
            assert len(result.message) > 0
            assert result.timestamp is not None
    
    @given(st.sampled_from([
        'suicide', 'kill myself', 'self-harm', 'hurt others', 
        'end my life', 'want to die', 'better off dead'
    ]))
    def test_trigger_word_detection(self, trigger_word):
        """
        Property 3c: Trigger Word Detection
        For any known trigger word, crisis detection must activate
        **Validates: Requirements 3.1, 3.3**
        """
        # Test trigger word in various contexts
        test_cases = [
            trigger_word,
            f"I am thinking about {trigger_word}",
            f"Sometimes I {trigger_word}",
            f"{trigger_word.upper()}",  # Test case insensitivity
            f"  {trigger_word}  ",  # Test with whitespace
        ]
        
        for test_text in test_cases:
            result = self.safety_monitor.check_for_crisis(test_text)
            assert result.level == CrisisLevel.CRITICAL
            assert trigger_word.lower() in [word.lower() for word in result.triggered_words]
            assert result.requires_override is True
    
    @given(st.text(alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd', 'Pc', 'Pd', 'Ps', 'Pe', 'Po')), min_size=1, max_size=200))
    def test_safe_text_no_false_positives(self, text):
        """
        Property 3d: Safe Text No False Positives
        For any text without trigger words, crisis should not be detected
        **Validates: Requirements 3.1**
        """
        # Skip if text contains any trigger words
        trigger_words = self.safety_monitor.critical_triggers + self.safety_monitor.warning_indicators
        text_lower = text.lower()
        
        assume(not any(trigger.lower() in text_lower for trigger in trigger_words))
        
        result = self.safety_monitor.check_for_crisis(text)
        assert result.level == CrisisLevel.NONE
        assert result.requires_override is False
        assert len(result.triggered_words) == 0
    
    @given(st.text(min_size=1, max_size=100))
    def test_phq9_question9_consistency(self, response):
        """
        Property 3e: PHQ-9 Question 9 Consistency
        For any response, PHQ-9 Q9 detection should be consistent
        **Validates: Requirements 3.1, 3.5**
        """
        assume(len(response.strip()) > 0)
        
        # Run PHQ-9 Q9 check multiple times
        result1 = self.safety_monitor.check_phq9_question9(response)
        result2 = self.safety_monitor.check_phq9_question9(response)
        result3 = self.safety_monitor.check_phq9_question9(response)
        
        # Results should be identical
        assert result1 == result2 == result3
    
    @given(st.sampled_from(['yes', 'sometimes', 'often', 'nearly every day', 'several days']))
    def test_phq9_positive_responses(self, positive_indicator):
        """
        Property 3f: PHQ-9 Positive Response Detection
        For any known positive indicator, PHQ-9 Q9 should detect positive response
        **Validates: Requirements 3.1, 3.5**
        """
        test_responses = [
            positive_indicator,
            f"Well, {positive_indicator}",
            f"{positive_indicator}, I have been thinking about it",
            f"{positive_indicator.upper()}",  # Test case insensitivity
        ]
        
        for response in test_responses:
            result = self.safety_monitor.check_phq9_question9(response)
            assert result is True
    
    @given(st.sampled_from(['no', 'never', 'not at all', 'absolutely not', 'definitely not']))
    def test_phq9_negative_responses(self, negative_indicator):
        """
        Property 3g: PHQ-9 Negative Response Detection
        For any clear negative indicator, PHQ-9 Q9 should not detect positive response
        **Validates: Requirements 3.1**
        """
        # Test short, clear negative responses
        short_responses = [
            negative_indicator,
            f"{negative_indicator}.",
            f"  {negative_indicator}  ",
        ]
        
        for response in short_responses:
            if len(response.strip()) < 20:  # Short responses
                result = self.safety_monitor.check_phq9_question9(response)
                assert result is False
    
    @given(st.text(min_size=1, max_size=200))
    def test_crisis_handler_override_logic(self, text):
        """
        Property 3h: Crisis Handler Override Logic
        For any text, crisis handler should properly determine override necessity
        **Validates: Requirements 3.3, 3.4, 3.5**
        """
        assume(len(text.strip()) > 0)
        
        # Test regular crisis check
        should_override, message = self.crisis_handler.process_user_input(text, is_phq9_q9=False)
        crisis_response = self.safety_monitor.check_for_crisis(text)
        
        # If crisis is CRITICAL, override should be True
        if crisis_response.level == CrisisLevel.CRITICAL:
            assert should_override is True
            assert message is not None
            assert len(message) > 0
        
        # If crisis is NONE or WARNING, override should be False for regular text
        if crisis_response.level in [CrisisLevel.NONE, CrisisLevel.WARNING]:
            assert should_override is False
    
    @given(st.text(min_size=1, max_size=100))
    def test_crisis_handler_phq9_override(self, response):
        """
        Property 3i: Crisis Handler PHQ-9 Override
        For any PHQ-9 Q9 response, handler should override if positive detected
        **Validates: Requirements 3.5**
        """
        assume(len(response.strip()) > 0)
        
        should_override, message = self.crisis_handler.process_user_input(response, is_phq9_q9=True)
        phq9_positive = self.safety_monitor.check_phq9_question9(response)
        
        # If PHQ-9 Q9 is positive, override should be True
        if phq9_positive:
            assert should_override is True
            assert message is not None
            assert len(message) > 0
            assert self.crisis_handler.is_crisis_active() is True
    
    def test_crisis_state_management(self):
        """
        Property 3j: Crisis State Management
        Crisis state should be properly managed and resettable
        **Validates: Requirements 3.4, 3.5**
        """
        # Initially no crisis
        assert self.crisis_handler.is_crisis_active() is False
        
        # Trigger crisis
        self.crisis_handler.process_user_input("I want to kill myself", is_phq9_q9=False)
        assert self.crisis_handler.is_crisis_active() is True
        
        # Reset crisis state
        self.crisis_handler.reset_crisis_state()
        assert self.crisis_handler.is_crisis_active() is False


# Additional unit tests for specific edge cases
class TestCrisisDetectionEdgeCases:
    """Unit tests for specific edge cases and examples"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.safety_monitor = SafetyMonitor()
    
    def test_empty_input_handling(self):
        """Test handling of empty or None inputs"""
        assert self.safety_monitor.check_for_crisis("").level == CrisisLevel.NONE
        assert self.safety_monitor.check_for_crisis(None).level == CrisisLevel.NONE
        assert self.safety_monitor.check_phq9_question9("") is False
        assert self.safety_monitor.check_phq9_question9(None) is False
    
    def test_custom_trigger_words(self):
        """Test adding custom trigger words"""
        custom_monitor = SafetyMonitor(['custom_trigger'])
        result = custom_monitor.check_for_crisis("I feel custom_trigger")
        assert result.level == CrisisLevel.CRITICAL
        assert 'custom_trigger' in result.triggered_words
    
    def test_case_insensitive_detection(self):
        """Test that detection is case insensitive"""
        test_cases = ['SUICIDE', 'Suicide', 'sUiCiDe', 'suicide']
        for case in test_cases:
            result = self.safety_monitor.check_for_crisis(f"I am thinking about {case}")
            assert result.level == CrisisLevel.CRITICAL
    
    def test_warning_vs_critical_distinction(self):
        """Test distinction between warning and critical levels"""
        # Warning level
        warning_result = self.safety_monitor.check_for_crisis("I feel hopeless")
        assert warning_result.level == CrisisLevel.WARNING
        assert warning_result.requires_override is False
        
        # Critical level
        critical_result = self.safety_monitor.check_for_crisis("I want to kill myself")
        assert critical_result.level == CrisisLevel.CRITICAL
        assert critical_result.requires_override is True