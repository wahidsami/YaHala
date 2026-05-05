import { registerRootComponent } from 'expo';
import App from './src/app/App';
import { installRuntimeErrorLogging } from './src/shared/debug/runtimeLogger';

installRuntimeErrorLogging();

registerRootComponent(App);
