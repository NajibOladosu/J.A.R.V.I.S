import pyttsx3
import speech_recognition as sr
import logging
import asyncio
from typing import Dict, Any
import threading
import time

class VoiceTasks:
    def __init__(self):
        # Initialize TTS engine
        self._microphone_lock = threading.Lock()
        self._tts_lock = threading.Lock()
        self._last_listen_time = 0
        self.tts_engine = None
        try:
            import platform
            if platform.system() == 'Darwin':  # macOS
                # Try to import required modules for macOS TTS
                try:
                    import objc
                    self.tts_engine = pyttsx3.init()
                    self.setup_tts()
                except ImportError:
                    logging.warning("TTS not available: objc module not found (normal on some macOS setups)")
                    self.tts_engine = None
            else:
                self.tts_engine = pyttsx3.init()
                self.setup_tts()
        except Exception as e:
            logging.warning(f"TTS initialization failed (this is non-critical): {e}")
            self.tts_engine = None
        
        # Initialize speech recognition
        self.recognizer = sr.Recognizer()
        self.microphone = None
        try:
            self.microphone = sr.Microphone()
            self.setup_microphone()
        except Exception as e:
            logging.error(f"Failed to initialize microphone: {e}")
    
    def setup_tts(self):
        """Configure TTS engine settings"""
        if not self.tts_engine:
            return
        
        try:
            # Set voice properties
            voices = self.tts_engine.getProperty('voices')
            if voices:
                # Prefer female voice if available
                for voice in voices:
                    if 'female' in voice.name.lower() or 'woman' in voice.name.lower():
                        self.tts_engine.setProperty('voice', voice.id)
                        break
                else:
                    # Use first available voice
                    self.tts_engine.setProperty('voice', voices[0].id)
            
            # Set speech rate and volume
            self.tts_engine.setProperty('rate', 200)  # Speed of speech
            self.tts_engine.setProperty('volume', 0.9)  # Volume level (0.0 to 1.0)
            
        except Exception as e:
            logging.error(f"Error setting up TTS: {e}")
    
    def setup_microphone(self):
        """Configure microphone settings"""
        if not self.microphone:
            return
        
        try:
            # Configure recognizer settings for better speech detection
            self.recognizer.energy_threshold = 300  # Lower for better sensitivity
            self.recognizer.dynamic_energy_threshold = True  # Automatically adjust
            self.recognizer.pause_threshold = 1.0  # Seconds of silence before considering phrase complete
            self.recognizer.phrase_threshold = 0.3  # Minimum seconds of speaking audio before phrase
            self.recognizer.non_speaking_duration = 0.8  # Seconds of silence to consider phrase complete
            
            logging.info("Microphone configured with optimized settings")
            logging.info(f"Energy threshold: {self.recognizer.energy_threshold}")
            logging.info(f"Pause threshold: {self.recognizer.pause_threshold}")
            logging.info(f"Dynamic energy adjustment: {self.recognizer.dynamic_energy_threshold}")
            
        except Exception as e:
            logging.error(f"Error setting up microphone: {e}")
    
    async def speak(self, text: str, blocking: bool = False) -> Dict[str, Any]:
        """Convert text to speech"""
        try:
            if not self.tts_engine:
                return {
                    "success": False,
                    "message": "TTS engine not available"
                }
            
            def speak_sync():
                with self._tts_lock:
                    try:
                        self.tts_engine.say(text)
                        self.tts_engine.runAndWait()
                    except RuntimeError as e:
                        if "run loop already started" in str(e):
                            # Try alternative approach without runAndWait
                            logging.warning("TTS run loop conflict, using alternative method")
                            self.tts_engine.say(text)
                            # Give time for speech to complete
                            time.sleep(len(text) * 0.1)
                        else:
                            raise e
            
            if blocking:
                # Run synchronously
                speak_sync()
            else:
                # Run in separate thread to avoid blocking
                thread = threading.Thread(target=speak_sync)
                thread.daemon = True
                thread.start()
            
            logging.info(f"Speaking: {text[:50]}...")
            return {
                "success": True,
                "message": f"Successfully spoke text: {text[:50]}...",
                "text": text,
                "blocking": blocking
            }
            
        except Exception as e:
            logging.error(f"Error in TTS: {e}")
            return {
                "success": False,
                "message": f"Failed to speak text: {str(e)}"
            }
    
    async def listen(self, timeout: int = 10, phrase_timeout: int = None) -> Dict[str, Any]:
        """Listen for speech input and convert to text"""
        try:
            if not self.microphone:
                return {
                    "success": False,
                    "message": "Microphone not available"
                }
            
            # Prevent concurrent microphone access
            current_time = time.time()
            if current_time - self._last_listen_time < 1.0:  # 1 second cooldown
                return {
                    "success": False,
                    "message": "Please wait a moment before trying again",
                    "timeout": True
                }
            
            def listen_sync():
                try:
                    # Acquire lock to prevent concurrent access
                    with self._microphone_lock:
                        with self.microphone as source:
                            # Enhanced ambient noise adjustment
                            logging.info("Adjusting for ambient noise...")
                            self.recognizer.adjust_for_ambient_noise(source, duration=2.0)
                            
                            # Log current settings
                            logging.info(f"Listening for speech (timeout: {timeout}s)...")
                            logging.info(f"Energy threshold: {self.recognizer.energy_threshold}")
                            logging.info(f"Pause threshold: {self.recognizer.pause_threshold}")
                            
                            # Listen for speech with improved settings
                            # No phrase_time_limit allows longer phrases
                            audio = self.recognizer.listen(
                                source, 
                                timeout=timeout,
                                phrase_time_limit=phrase_timeout  # None allows unlimited phrase length
                            )
                            
                            logging.info("Audio captured successfully")
                        
                        # Use Google Speech Recognition (requires internet)
                        logging.info("Processing speech with Google Speech Recognition...")
                        text = self.recognizer.recognize_google(audio)
                        logging.info(f"Speech recognition successful: '{text}'")
                        return text
                        
                except sr.WaitTimeoutError:
                    logging.info("Speech recognition timeout - no speech detected")
                    return None
                except sr.UnknownValueError:
                    logging.warning("Speech recognition could not understand audio")
                    return ""
                except sr.RequestError as e:
                    logging.error(f"Speech recognition service error: {e}")
                    return f"SERVICE_ERROR: {str(e)}"
                except Exception as e:
                    logging.error(f"Speech recognition error: {e}")
                    raise e
            
            # Update last listen time
            self._last_listen_time = current_time
            
            # Run in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            text = await loop.run_in_executor(None, listen_sync)
            
            if text is None:
                return {
                    "success": False,
                    "message": "No speech detected within timeout",
                    "timeout": True
                }
            elif text == "":
                return {
                    "success": False,
                    "message": "Could not understand speech - please speak more clearly",
                    "unclear": True
                }
            elif text.startswith("SERVICE_ERROR:"):
                return {
                    "success": False,
                    "message": f"Speech recognition service unavailable: {text[14:]}"
                }
            else:
                logging.info(f"Speech recognized: {text}")
                return {
                    "success": True,
                    "message": "Speech recognized successfully",
                    "text": text
                }
                
        except Exception as e:
            logging.error(f"Error in speech recognition: {e}")
            return {
                "success": False,
                "message": f"Failed to recognize speech: {str(e)}"
            }
    
    async def get_voice_info(self) -> Dict[str, Any]:
        """Get information about available voices and audio devices"""
        try:
            voice_info = {
                "tts_available": self.tts_engine is not None,
                "microphone_available": self.microphone is not None,
                "voices": [],
                "audio_devices": []
            }
            
            # Get TTS voices
            if self.tts_engine:
                try:
                    voices = self.tts_engine.getProperty('voices')
                    if voices:
                        for voice in voices:
                            voice_info["voices"].append({
                                "id": voice.id,
                                "name": voice.name,
                                "gender": "female" if any(word in voice.name.lower() 
                                                        for word in ['female', 'woman']) else "male"
                            })
                except Exception as e:
                    logging.error(f"Error getting voices: {e}")
            
            # Get audio input devices
            try:
                mic_list = sr.Microphone.list_microphone_names()
                voice_info["audio_devices"] = mic_list
            except Exception as e:
                logging.error(f"Error getting audio devices: {e}")
            
            return {
                "success": True,
                "message": "Voice information retrieved",
                "data": voice_info
            }
            
        except Exception as e:
            logging.error(f"Error getting voice info: {e}")
            return {
                "success": False,
                "message": f"Failed to get voice info: {str(e)}"
            }
    
    async def calibrate_microphone(self, duration: float = 3.0) -> Dict[str, Any]:
        """Calibrate microphone settings for current environment"""
        try:
            if not self.microphone:
                return {
                    "success": False,
                    "message": "Microphone not available"
                }
            
            with self._microphone_lock:
                with self.microphone as source:
                    logging.info(f"Calibrating microphone for {duration} seconds...")
                    
                    # Extended ambient noise adjustment
                    self.recognizer.adjust_for_ambient_noise(source, duration=duration)
                    
                    # Log new settings
                    new_threshold = self.recognizer.energy_threshold
                    logging.info(f"Calibration complete. New energy threshold: {new_threshold}")
            
            return {
                "success": True,
                "message": "Microphone calibrated successfully",
                "energy_threshold": new_threshold,
                "calibration_duration": duration
            }
            
        except Exception as e:
            logging.error(f"Error calibrating microphone: {e}")
            return {
                "success": False,
                "message": f"Failed to calibrate microphone: {str(e)}"
            }
    
    async def adjust_sensitivity(self, sensitivity: str = "medium") -> Dict[str, Any]:
        """Adjust microphone sensitivity (low, medium, high)"""
        try:
            sensitivity_settings = {
                "low": {
                    "energy_threshold": 4000,
                    "pause_threshold": 1.5,
                    "phrase_threshold": 0.5
                },
                "medium": {
                    "energy_threshold": 300,
                    "pause_threshold": 1.0,
                    "phrase_threshold": 0.3
                },
                "high": {
                    "energy_threshold": 100,
                    "pause_threshold": 0.8,
                    "phrase_threshold": 0.2
                }
            }
            
            if sensitivity not in sensitivity_settings:
                return {
                    "success": False,
                    "message": f"Invalid sensitivity level. Choose from: {list(sensitivity_settings.keys())}"
                }
            
            settings = sensitivity_settings[sensitivity]
            
            # Apply settings
            self.recognizer.energy_threshold = settings["energy_threshold"]
            self.recognizer.pause_threshold = settings["pause_threshold"]
            self.recognizer.phrase_threshold = settings["phrase_threshold"]
            
            logging.info(f"Sensitivity adjusted to '{sensitivity}'")
            logging.info(f"Energy threshold: {self.recognizer.energy_threshold}")
            
            return {
                "success": True,
                "message": f"Sensitivity adjusted to '{sensitivity}'",
                "settings": settings
            }
            
        except Exception as e:
            logging.error(f"Error adjusting sensitivity: {e}")
            return {
                "success": False,
                "message": f"Failed to adjust sensitivity: {str(e)}"
            }